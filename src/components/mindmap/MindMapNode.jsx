import React from 'react';
import { motion } from 'framer-motion';
import { STATUS_STYLES } from '@/lib/theme-constants';

// SVG glass orb node with gradient, glow, and status-driven visuals
export function MindMapNode({ node, isSelected, onClick }) {
  const gradientId = `grad-${node.id}`;
  const glowFilterId = `glow-${node.id}`;
  const highlightId = `highlight-${node.id}`;

  const statusStyle = STATUS_STYLES[node.status] || STATUS_STYLES.not_started;
  const glowIntensity = statusStyle.glowIntensity || 0;
  const isRelayState = node.status === 'waiting_for_materials' || node.status === 'waiting_for_external' || node.status === 'waiting_for_approval';
  const isIssue = node.status === 'issue';
  const isFilingReady = node.status === 'ready_for_reporting';
  const isCompleted = node.status === 'completed';

  // Dynamic opacity: completed nodes are muted
  const baseOpacity = isCompleted ? 0.5 : 1;

  // Relay state overrides gradient to ocean blue
  const effectiveFrom = isRelayState ? '#3b82f6' : node.gradientFrom;
  const effectiveTo = isRelayState ? '#0ea5e9' : node.gradientTo;

  // Issue overrides to red
  const issueFrom = '#ef4444';
  const issueTo = '#dc2626';

  // Filing ready overrides to amber
  const filingFrom = '#f59e0b';
  const filingTo = '#fbbf24';

  const finalFrom = isIssue ? issueFrom : isFilingReady ? filingFrom : effectiveFrom;
  const finalTo = isIssue ? issueTo : isFilingReady ? filingTo : effectiveTo;

  // Animation variants based on status
  const getAnimationProps = () => {
    if (isRelayState) {
      return {
        animate: {
          opacity: [baseOpacity * 0.7, baseOpacity, baseOpacity * 0.7],
          scale: [1, 1.02, 1],
        },
        transition: {
          duration: 3,
          ease: 'easeInOut',
          repeat: Infinity,
        },
      };
    }
    if (isIssue || isFilingReady) {
      return {
        animate: {
          scale: [1, 1.04, 1],
        },
        transition: {
          duration: 2,
          ease: 'easeInOut',
          repeat: Infinity,
        },
      };
    }
    return {
      animate: { scale: 1, opacity: baseOpacity },
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    };
  };

  const animProps = getAnimationProps();

  // Label font size scales with node radius
  const fontSize = node.type === 'hub' ? 14 : node.type === 'category' ? 12 : Math.max(9, Math.min(11, node.radius * 0.45));
  const labelHeight = node.type === 'hub' ? 40 : node.type === 'category' ? 32 : 24;

  // Sub-label for stats (category nodes show progress, hub shows counts)
  const getSubLabel = () => {
    if (node.type === 'hub' && node.data) {
      return `${node.data.clientCount} לקוחות`;
    }
    if (node.type === 'category' && node.data) {
      return `${node.data.progress}%`;
    }
    if (node.type === 'client' && node.data) {
      const total = node.data.taskCount + node.data.reconCount;
      if (total === 0) return '';
      return `${node.data.completedCount}/${total}`;
    }
    return '';
  };

  const subLabel = getSubLabel();

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={animProps.animate}
      transition={animProps.transition || { type: 'spring', stiffness: 300, damping: 20 }}
      style={{ cursor: 'pointer', transformOrigin: `${node.x}px ${node.y}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(node);
      }}
    >
      {/* Definitions: gradient, glow filter */}
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={finalFrom} stopOpacity="0.9" />
          <stop offset="100%" stopColor={finalTo} stopOpacity="0.65" />
        </radialGradient>

        <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={3 + glowIntensity * 5} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <radialGradient id={highlightId} cx="35%" cy="30%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer glow ring */}
      {glowIntensity > 0 && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius + 6}
          fill="none"
          stroke={finalFrom}
          strokeWidth={2}
          strokeOpacity={glowIntensity * 0.5}
          filter={`url(#${glowFilterId})`}
        />
      )}

      {/* Shadow circle (depth effect) */}
      <circle
        cx={node.x + 2}
        cy={node.y + 3}
        r={node.radius}
        fill="rgba(0,0,0,0.15)"
      />

      {/* Main bubble with gradient */}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        fill={`url(#${gradientId})`}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={isSelected ? 2.5 : 1.2}
      />

      {/* Inner glass highlight (reflection) */}
      <ellipse
        cx={node.x - node.radius * 0.15}
        cy={node.y - node.radius * 0.22}
        rx={node.radius * 0.45}
        ry={node.radius * 0.28}
        fill={`url(#${highlightId})`}
      />

      {/* Label using foreignObject for Hebrew text support */}
      <foreignObject
        x={node.x - node.radius}
        y={node.y - labelHeight / 2}
        width={node.radius * 2}
        height={labelHeight}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: "'Varela Round', 'Assistant', sans-serif",
            color: 'white',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            lineHeight: 1.2,
            overflow: 'hidden',
          }}
        >
          <span style={{
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            display: 'block',
            padding: '0 2px',
          }}>
            {node.label}
          </span>
          {subLabel && (
            <span style={{
              fontSize: `${Math.max(8, fontSize - 2)}px`,
              opacity: 0.8,
              fontWeight: 400,
            }}>
              {subLabel}
            </span>
          )}
        </div>
      </foreignObject>
    </motion.g>
  );
}
