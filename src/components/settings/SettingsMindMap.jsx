/**
 * ── SettingsMindMap: Interactive Process Architect Hub ──
 * Renders P1-P4 as an organic AYOA-style mind map.
 * Each root branches into services → steps (N-level).
 * Supports: Template viewing, Board mapping, Floating toolbar.
 *
 * SVG uses ABSOLUTE coordinates only (viewBox 0 0 1000 800).
 * No percentages in SVG d-attributes.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildTaperedBranch, AYOA_PALETTE } from '../canvas/AyoaNode';
import {
  TAX_SERVICES,
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
  ALL_SERVICES,
} from '@/config/processTemplates';
import { Plus, X, ChevronDown, ChevronUp, Copy, Link2, Layers } from 'lucide-react';

// ── DNA Colors ──
const DNA = {
  P1: { color: '#00A3E0', label: 'P1 שכר', bg: '#00A3E015', glow: '#00A3E040' },
  P2: { color: '#B2AC88', label: 'P2 הנה"ח', bg: '#B2AC8815', glow: '#B2AC8840' },
  P3: { color: '#E91E63', label: 'P3 ביצוע', bg: '#E91E6315', glow: '#E91E6340' },
  P4: { color: '#FFC107', label: 'P4 בית', bg: '#FFC10715', glow: '#FFC10740' },
};

const VB_W = 1000, VB_H = 800;
const CX = VB_W / 2, CY = VB_H / 2;

// ── Map P-roots to their service groups ──
const P_ROOTS = [
  {
    key: 'P1', ...DNA.P1,
    services: Object.values(PAYROLL_SERVICES),
    angle: -Math.PI * 0.75, // top-left
  },
  {
    key: 'P2', ...DNA.P2,
    services: [
      ...Object.values(TAX_SERVICES),
      ...Object.values(ADDITIONAL_SERVICES).filter(s => s.dashboard === 'tax'),
    ],
    angle: -Math.PI * 0.25, // top-right
  },
  {
    key: 'P3', ...DNA.P3,
    services: Object.values(ADDITIONAL_SERVICES).filter(
      s => s.dashboard === 'admin' || s.dashboard === 'additional'
    ),
    angle: Math.PI * 0.25, // bottom-right
  },
  {
    key: 'P4', ...DNA.P4,
    services: [], // Home — no services yet (personal)
    angle: Math.PI * 0.75, // bottom-left
  },
];

// ── Organic Cloud Shape (absolute SVG coords) ──
function CloudShape({ cx, cy, r, fill, stroke, strokeWidth = 2, opacity = 1 }) {
  const d = `M ${cx - r * 0.55} ${cy + r * 0.22} ` +
    `C ${cx - r * 0.88} ${cy + r * 0.22} ${cx - r} ${cy - r * 0.11} ${cx - r * 0.77} ${cy - r * 0.39} ` +
    `C ${cx - r * 0.77} ${cy - r * 0.72} ${cx - r * 0.39} ${cy - r * 0.88} ${cx - r * 0.11} ${cy - r * 0.66} ` +
    `C ${cx + r * 0.06} ${cy - r * 0.94} ${cx + r * 0.5} ${cy - r * 0.88} ${cx + r * 0.61} ${cy - r * 0.61} ` +
    `C ${cx + r * 0.94} ${cy - r * 0.55} ${cx + r} ${cy - r * 0.11} ${cx + r * 0.77} ${cy + r * 0.11} ` +
    `C ${cx + r * 0.88} ${cy + r * 0.39} ${cx + r * 0.61} ${cy + r * 0.55} ${cx + r * 0.28} ${cy + r * 0.5} ` +
    `C ${cx + r * 0.11} ${cy + r * 0.66} ${cx - r * 0.28} ${cy + r * 0.61} ${cx - r * 0.55} ${cy + r * 0.22} Z`;
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
}

// ── Bubble Shape ──
function BubbleShape({ cx, cy, rx, ry, fill, stroke, strokeWidth = 2 }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry || rx * 0.85} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

export default function SettingsMindMap({ onSelectService }) {
  const svgRef = useRef(null);
  const [expandedRoot, setExpandedRoot] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Layout: compute node positions
  const layout = useMemo(() => {
    const rootRadius = 200;
    const serviceRadius = 120;

    return P_ROOTS.map((root, ri) => {
      const rx = CX + Math.cos(root.angle) * rootRadius;
      const ry = CY + Math.sin(root.angle) * rootRadius;

      const serviceNodes = root.services.map((svc, si) => {
        const count = root.services.length || 1;
        const spreadAngle = Math.PI * 0.6;
        const baseAngle = root.angle - spreadAngle / 2;
        const sAngle = baseAngle + (spreadAngle * si) / Math.max(1, count - 1);
        const sx = rx + Math.cos(sAngle) * serviceRadius;
        const sy = ry + Math.sin(sAngle) * serviceRadius;

        // Step children
        const stepNodes = (svc.steps || []).map((step, sti) => {
          const stepSpread = Math.PI * 0.4;
          const stepBase = sAngle - stepSpread / 2;
          const stAngle = stepBase + (stepSpread * sti) / Math.max(1, (svc.steps.length || 1) - 1);
          const stR = 70;
          return {
            ...step,
            x: sx + Math.cos(stAngle) * stR,
            y: sy + Math.sin(stAngle) * stR,
            parentX: sx,
            parentY: sy,
          };
        });

        return {
          ...svc,
          x: sx, y: sy,
          parentX: rx, parentY: ry,
          stepNodes,
        };
      });

      return {
        ...root,
        x: rx, y: ry,
        serviceNodes,
      };
    });
  }, []);

  const handleRootClick = useCallback((key) => {
    setExpandedRoot(prev => prev === key ? null : key);
    setSelectedService(null);
  }, []);

  const handleServiceClick = useCallback((svc) => {
    setSelectedService(prev => prev?.key === svc.key ? null : svc);
    onSelectService?.(svc);
  }, [onSelectService]);

  return (
    <div className="relative w-full" style={{ minHeight: '600px' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 220px)', minHeight: '550px' }}
      >
        <defs>
          <filter id="settings-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#4682B4" floodOpacity="0.3" />
          </filter>
          <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
          </filter>
          {/* Gradient for center hub */}
          <radialGradient id="hub-grad">
            <stop offset="0%" stopColor="#2C3E50" />
            <stop offset="100%" stopColor="#1a252f" />
          </radialGradient>
        </defs>

        {/* ── Branches from center to P-roots ── */}
        {layout.map(root => (
          <path
            key={`branch-${root.key}`}
            d={buildTaperedBranch(CX, CY, root.x, root.y, 8, 3)}
            fill={root.color}
            opacity={0.4}
            style={{ transition: 'opacity 0.3s ease' }}
          />
        ))}

        {/* ── Service branches (only when expanded) ── */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.map(svc => (
            <React.Fragment key={`svc-branch-${svc.key}`}>
              <path
                d={buildTaperedBranch(root.x, root.y, svc.x, svc.y, 4, 1.5)}
                fill={root.color}
                opacity={0.35}
                style={{ transition: 'opacity 0.3s ease' }}
              />
              {/* Step branches (only when service selected) */}
              {selectedService?.key === svc.key && svc.stepNodes.map((step, i) => (
                <path
                  key={`step-branch-${svc.key}-${i}`}
                  d={buildTaperedBranch(svc.x, svc.y, step.x, step.y, 2.5, 0.8)}
                  fill={root.color}
                  opacity={0.25}
                />
              ))}
            </React.Fragment>
          ));
        })}

        {/* ── Center Hub ── */}
        <circle cx={CX} cy={CY} r={52} fill="url(#hub-grad)" filter="url(#settings-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">
          CalmPlan
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill="#B0BEC5" fontSize="11">
          Process Architect
        </text>
        <text x={CX} y={CY + 22} textAnchor="middle" fill="#78909C" fontSize="9">
          {Object.keys(ALL_SERVICES).length} שירותים
        </text>

        {/* ── P-Root Nodes ── */}
        {layout.map(root => {
          const isExpanded = expandedRoot === root.key;
          const isHovered = hoveredNode === root.key;
          const r = isExpanded ? 52 : 44;
          return (
            <g
              key={`root-${root.key}`}
              onClick={() => handleRootClick(root.key)}
              onMouseEnter={() => setHoveredNode(root.key)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow ring on hover */}
              {(isHovered || isExpanded) && (
                <circle cx={root.x} cy={root.y} r={r + 6} fill="none"
                  stroke={root.color} strokeWidth={1.5} opacity={0.4}
                  strokeDasharray={isExpanded ? 'none' : '6 3'}>
                  {!isExpanded && (
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${root.x} ${root.y}`} to={`360 ${root.x} ${root.y}`}
                      dur="12s" repeatCount="indefinite" />
                  )}
                </circle>
              )}
              <CloudShape cx={root.x} cy={root.y} r={r} fill={root.bg} stroke={root.color} strokeWidth={2.5} />
              <CloudShape cx={root.x} cy={root.y} r={r - 2} fill="white" stroke="none" strokeWidth={0} opacity={0.85} />
              <text x={root.x} y={root.y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#263238">
                {root.key}
              </text>
              <text x={root.x} y={root.y + 10} textAnchor="middle" fontSize="10" fill={root.color} fontWeight="500">
                {root.label.replace(root.key + ' ', '')}
              </text>
              <text x={root.x} y={root.y + 24} textAnchor="middle" fontSize="8" fill="#90A4AE">
                {root.services.length} שירותים
              </text>
            </g>
          );
        })}

        {/* ── Service Nodes (expanded root only) ── */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.map(svc => {
            const isSelected = selectedService?.key === svc.key;
            const r = isSelected ? 34 : 28;
            return (
              <g
                key={`svc-${svc.key}`}
                onClick={(e) => { e.stopPropagation(); handleServiceClick(svc); }}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle cx={svc.x} cy={svc.y} r={r + 5} fill="none"
                    stroke={root.color} strokeWidth={1.2} opacity={0.5}
                    strokeDasharray="4 3">
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${svc.x} ${svc.y}`} to={`360 ${svc.x} ${svc.y}`}
                      dur="10s" repeatCount="indefinite" />
                  </circle>
                )}
                <BubbleShape cx={svc.x} cy={svc.y} rx={r} fill={root.bg} stroke={root.color} strokeWidth={1.8} />
                <BubbleShape cx={svc.x} cy={svc.y} rx={r - 1.5} fill="white" stroke="none" />
                <text x={svc.x} y={svc.y - 2} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238">
                  {(svc.label || '').substring(0, 14)}
                </text>
                <text x={svc.x} y={svc.y + 10} textAnchor="middle" fontSize="7" fill={root.color}>
                  {(svc.steps || []).length} שלבים
                </text>
              </g>
            );
          });
        })}

        {/* ── Step Nodes (selected service only) ── */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.map(svc => {
            if (selectedService?.key !== svc.key) return null;
            return svc.stepNodes.map((step, i) => (
              <g key={`step-${svc.key}-${i}`}>
                <circle cx={step.x} cy={step.y} r={18} fill={root.bg} stroke={root.color} strokeWidth={1} />
                <circle cx={step.x} cy={step.y} r={16.5} fill="white" stroke="none" />
                <text x={step.x} y={step.y - 1} textAnchor="middle" fontSize="7" fontWeight="500" fill="#37474F">
                  {(step.label || '').substring(0, 10)}
                </text>
                <text x={step.x} y={step.y + 8} textAnchor="middle" fontSize="6" fill="#90A4AE">
                  {i + 1}
                </text>
              </g>
            ));
          });
        })}
      </svg>

      {/* ── Legend ── */}
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-100">
        {Object.entries(DNA).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-[10px] font-medium" style={{ color: val.color }}>{key}</span>
          </div>
        ))}
      </div>

      {/* ── Instructions ── */}
      <div className="absolute bottom-3 left-3 text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-100">
        לחץ על ענף P כדי לפתוח • לחץ על שירות לראות שלבים
      </div>
    </div>
  );
}
