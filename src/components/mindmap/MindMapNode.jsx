import React from 'react';
import { motion } from 'framer-motion';
import { STATUS_STYLES, COMPLEXITY_TIERS } from '@/lib/theme-constants';

// ══════════════════════════════════════════════════════════════════
// LAW 3: VISUAL HIERARCHY
// ══════════════════════════════════════════════════════════════════
//
// Level 0 (Hub): Deep Teal circle — "My Day"
// Level 1 (Categories): Large Soft-Square — Deep Teal, 24px corners, glow
// Level 2 (Clients): Pills — small rounded rects, status-colored
//
// Contrast: Category = Solid/Strong, Client = Light/Sleek
// ══════════════════════════════════════════════════════════════════

// Status-driven colors for client pills
const STATUS_COLORS = {
  completed:                    '#22c55e',
  in_progress:                  '#3b82f6',
  not_started:                  '#94a3b8',
  remaining_completions:        '#00ACC1',
  postponed:                    '#78909C',
  waiting_for_approval:         '#AB47BC',
  waiting_for_materials:        '#F59E0B',
  issue:                        '#ef4444',
  ready_for_reporting:          '#f59e0b',
  reported_waiting_for_payment: '#FBC02D',
  waiting_on_client:            '#F59E0B',
  pending_external:             '#1565C0',
  not_relevant:                 '#B0BEC5',
};

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#94a3b8';
}

// ─── Hub Node (Level 0): Deep Teal Circle ───
function HubNode({ node, isSelected, onClick }) {
  const r = node.radius || 52;
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      style={{ cursor: 'pointer', transformOrigin: `${node.x}px ${node.y}px` }}
      onClick={(e) => { e.stopPropagation(); onClick?.(node); }}
    >
      <defs>
        <radialGradient id="hub-gradient" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#00ACC1" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#00695C" stopOpacity="0.85" />
        </radialGradient>
        <filter id="hub-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx={node.x} cy={node.y} r={r + 8}
        fill="none" stroke="#00ACC1" strokeWidth="2"
        strokeOpacity="0.3" filter="url(#hub-glow)" />

      {/* Shadow */}
      <circle cx={node.x + 2} cy={node.y + 3} r={r}
        fill="rgba(0,0,0,0.15)" />

      {/* Main circle */}
      <circle cx={node.x} cy={node.y} r={r}
        fill="url(#hub-gradient)"
        stroke={isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
        strokeWidth={isSelected ? 2.5 : 1.5} />

      {/* Glass highlight */}
      <ellipse cx={node.x - r * 0.12} cy={node.y - r * 0.2}
        rx={r * 0.4} ry={r * 0.25}
        fill="white" fillOpacity="0.2" />

      {/* Label */}
      <foreignObject
        x={node.x - r} y={node.y - r * 0.6}
        width={r * 2} height={r * 1.2}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', color: 'white',
          fontFamily: "'Varela Round', 'Assistant', sans-serif",
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>{node.label}</span>
          {node.data && (
            <span style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
              {node.data.clientCount} לקוחות
            </span>
          )}
        </div>
      </foreignObject>
    </motion.g>
  );
}

// ─── Category Node (Level 1): Soft-Square Container — Deep Teal ───
function CategoryNode({ node, isSelected, onClick }) {
  const w = node.width || 140;
  const h = node.height || 80;
  const cr = node.cornerRadius || 24;
  const cx = node.x;
  const cy = node.y;
  const x = cx - w / 2;
  const y = cy - h / 2;

  const gradId = `cat-grad-${node.id}`;
  const glowId = `cat-glow-${node.id}`;
  const progress = node.data?.progress || 0;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}
      style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px` }}
      onClick={(e) => { e.stopPropagation(); onClick?.(node); }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00695C" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#004D40" stopOpacity="0.9" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow ring */}
      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8}
        rx={cr + 4} ry={cr + 4}
        fill="none" stroke="#00897B" strokeWidth="1.5"
        strokeOpacity="0.25" filter={`url(#${glowId})`} />

      {/* Shadow */}
      <rect x={x + 2} y={y + 3} width={w} height={h}
        rx={cr} ry={cr}
        fill="rgba(0,0,0,0.12)" />

      {/* Main body — Deep Teal solid */}
      <rect x={x} y={y} width={w} height={h}
        rx={cr} ry={cr}
        fill={`url(#${gradId})`}
        stroke={isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
        strokeWidth={isSelected ? 2 : 1} />

      {/* Inner top-left glass highlight */}
      <rect x={x + 8} y={y + 4} width={w * 0.5} height={h * 0.3}
        rx={cr / 2} ry={cr / 2}
        fill="white" fillOpacity="0.08" />

      {/* Progress bar at bottom */}
      {progress > 0 && (
        <rect x={x + 12} y={y + h - 10} width={(w - 24) * progress / 100} height={4}
          rx={2} ry={2} fill="#4ade80" fillOpacity="0.7" />
      )}

      {/* Label */}
      <foreignObject x={x} y={y} width={w} height={h}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', color: 'white',
          fontFamily: "'Varela Round', 'Assistant', sans-serif",
          textShadow: '0 1px 3px rgba(0,0,0,0.35)',
          padding: '4px 8px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.2 }}>
            {node.label}
          </span>
          {node.data && (
            <span style={{ fontSize: '11px', opacity: 0.75, marginTop: '3px' }}>
              {node.data.completedCount}/{node.data.totalCount} ({progress}%)
            </span>
          )}
        </div>
      </foreignObject>
    </motion.g>
  );
}

// ─── Client Node (Level 2): Status-Colored Pill ───
function ClientNode({ node, isSelected, onClick }) {
  const w = node.width || 80;
  const h = node.height || 36;
  const cx = node.x;
  const cy = node.y;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = h / 2; // pill corner radius = half height

  const statusColor = getStatusColor(node.status);
  const isCompleted = node.status === 'completed';
  const isIssue = node.status === 'issue';
  const isFilingReady = node.status === 'ready_for_reporting';
  // THE 19 ANCHORS: Balance-only clients are ghosted at 60% opacity
  const isGhosted = node.isGhosted === true;
  const baseOpacity = isGhosted ? 0.6 : isCompleted ? 0.45 : 1;

  const gradId = `client-grad-${node.id}`;
  const glowId = `client-glow-${node.id}`;
  const shouldGlow = isIssue || isFilingReady;

  // Tier badge
  const tierInfo = COMPLEXITY_TIERS[node.tier];
  const tierBadge = tierInfo?.icon;

  // Sub-label: task count
  const taskCount = node.data?.taskCount || 0;
  const completedCount = node.data?.completedCount || 0;
  const subLabel = taskCount > 0 ? `${completedCount}/${taskCount}` : '';

  // Animation
  const getAnimProps = () => {
    if (isIssue) {
      return {
        animate: { scale: [1, 1.04, 1], opacity: baseOpacity },
        transition: { duration: 1.5, ease: 'easeInOut', repeat: Infinity },
      };
    }
    if (isFilingReady) {
      return {
        animate: { scale: [1, 1.03, 1], opacity: baseOpacity },
        transition: { duration: 2, ease: 'easeInOut', repeat: Infinity },
      };
    }
    return {
      animate: { scale: 1, opacity: baseOpacity },
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    };
  };
  const animProps = getAnimProps();

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={animProps.animate}
      transition={animProps.transition}
      style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px` }}
      onClick={(e) => { e.stopPropagation(); onClick?.(node); }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={statusColor} stopOpacity={isCompleted ? 0.4 : 0.85} />
          <stop offset="100%" stopColor={statusColor} stopOpacity={isCompleted ? 0.25 : 0.65} />
        </linearGradient>
        {shouldGlow && (
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Glow ring for issue/filing */}
      {shouldGlow && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8}
          rx={r + 4} ry={r + 4}
          fill="none" stroke={statusColor} strokeWidth="1.5"
          strokeOpacity="0.4" filter={`url(#${glowId})`} />
      )}

      {/* Shadow */}
      <rect x={x + 1} y={y + 2} width={w} height={h}
        rx={r} ry={r}
        fill={isCompleted ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)'} />

      {/* Main pill body */}
      <rect x={x} y={y} width={w} height={h}
        rx={r} ry={r}
        fill={`url(#${gradId})`}
        stroke={isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
        strokeWidth={isSelected ? 2 : 0.8} />

      {/* Glass top highlight */}
      <rect x={x + 6} y={y + 3} width={w * 0.5} height={h * 0.35}
        rx={r * 0.6} ry={r * 0.6}
        fill="white" fillOpacity={isCompleted ? 0.08 : 0.18} />

      {/* Status dot (small circle at left edge) */}
      <circle cx={x + 10} cy={cy} r={4}
        fill={statusColor} fillOpacity={isCompleted ? 0.5 : 0.9}
        stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />

      {/* Label */}
      <foreignObject x={x + 16} y={y} width={w - 20} height={h}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', color: isCompleted ? 'rgba(255,255,255,0.55)' : 'white',
          fontFamily: "'Varela Round', 'Assistant', sans-serif",
          textShadow: isCompleted ? 'none' : '0 1px 3px rgba(0,0,0,0.35)',
          lineHeight: 1.15,
          overflow: 'hidden',
        }}>
          {tierBadge && (
            <span style={{ fontSize: '8px', marginBottom: '-1px' }}>{tierBadge}</span>
          )}
          <span style={{
            fontSize: '10px', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', maxWidth: '100%',
            display: 'block',
          }}>
            {node.label}
          </span>
          {subLabel && (
            <span style={{ fontSize: '8px', opacity: isCompleted ? 0.5 : 0.75 }}>
              {subLabel}
            </span>
          )}
        </div>
      </foreignObject>
    </motion.g>
  );
}

// ─── Main Export: Dispatch by node type ───
export function MindMapNode({ node, isSelected, onClick }) {
  switch (node.type) {
    case 'hub':
      return <HubNode node={node} isSelected={isSelected} onClick={onClick} />;
    case 'category':
      return <CategoryNode node={node} isSelected={isSelected} onClick={onClick} />;
    case 'client':
      return <ClientNode node={node} isSelected={isSelected} onClick={onClick} />;
    default:
      return <ClientNode node={node} isSelected={isSelected} onClick={onClick} />;
  }
}
