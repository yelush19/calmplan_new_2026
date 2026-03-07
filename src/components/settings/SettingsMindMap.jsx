/**
 * SettingsMindMap: LIVE CRUD Process Architect
 * Draws P1-P4 roots dynamically from ALL_SERVICES (real data).
 * Supports: Create, Update, Delete, Board reassignment.
 * State persists to localStorage. No hardcoded mock data.
 *
 * SVG uses ABSOLUTE coordinates only (viewBox 0 0 1000 800).
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { buildTaperedBranch } from '../canvas/AyoaNode';
import {
  ALL_SERVICES,
  TAX_SERVICES,
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
} from '@/config/processTemplates';
import { SERVICE_WEIGHTS, getServiceWeight } from '@/config/serviceWeights';

// DNA Colors
const DNA = {
  P1: { color: '#00A3E0', label: 'P1 שכר', bg: '#00A3E015', glow: '#00A3E040', dashboards: ['payroll'] },
  P2: { color: '#B2AC88', label: 'P2 הנה"ח', bg: '#B2AC8815', glow: '#B2AC8840', dashboards: ['tax'] },
  P3: { color: '#E91E63', label: 'P3 ביצוע', bg: '#E91E6315', glow: '#E91E6340', dashboards: ['admin', 'additional'] },
  P4: { color: '#FFC107', label: 'P4 בית', bg: '#FFC10715', glow: '#FFC10740', dashboards: [] },
};

// Map dashboard type to P-branch
function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  return 'P4';
}

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', branch: 'P1' },
  { key: 'tax', label: 'הנה"ח (P2)', branch: 'P2' },
  { key: 'admin', label: 'ניהול (P3)', branch: 'P3' },
  { key: 'additional', label: 'נוספים (P3)', branch: 'P3' },
];

const COGNITIVE_LABELS = ['ננו', 'פשוט', 'בינוני', 'מורכב'];

const VB_W = 1000, VB_H = 800;
const CX = VB_W / 2, CY = VB_H / 2;

// Load persisted overrides from localStorage
function loadOverrides() {
  try {
    const raw = localStorage.getItem('calmplan_service_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveOverrides(overrides) {
  localStorage.setItem('calmplan_service_overrides', JSON.stringify(overrides));
}

// Load custom services created by user
function loadCustomServices() {
  try {
    const raw = localStorage.getItem('calmplan_custom_services');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomServices(customs) {
  localStorage.setItem('calmplan_custom_services', JSON.stringify(customs));
}

// Cloud SVG shape
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

function BubbleShape({ cx, cy, rx, ry, fill, stroke, strokeWidth = 2 }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry || rx * 0.85} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

export default function SettingsMindMap({ onSelectService, onConfigChange }) {
  const svgRef = useRef(null);
  const [expandedRoot, setExpandedRoot] = useState(null);
  const [selectedServiceKey, setSelectedServiceKey] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [customServices, setCustomServices] = useState(loadCustomServices);

  // Build the LIVE service registry: base templates + overrides + custom services
  const liveServices = useMemo(() => {
    const merged = {};
    // Start from real ALL_SERVICES
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      merged[key] = { ...svc };
      // Apply any overrides (board changes, step edits, etc.)
      if (overrides[key]) {
        Object.assign(merged[key], overrides[key]);
      }
    }
    // Add custom user-created services
    for (const [key, svc] of Object.entries(customServices)) {
      merged[key] = { ...svc };
    }
    return merged;
  }, [overrides, customServices]);

  // Group services by P-branch (dynamic, from live data)
  const pRoots = useMemo(() => {
    const groups = { P1: [], P2: [], P3: [], P4: [] };
    for (const svc of Object.values(liveServices)) {
      const branch = getDashboardBranch(svc.dashboard);
      groups[branch].push(svc);
    }
    const angles = { P1: -Math.PI * 0.75, P2: -Math.PI * 0.25, P3: Math.PI * 0.25, P4: Math.PI * 0.75 };
    return Object.entries(DNA).map(([key, dna]) => ({
      key, ...dna,
      services: groups[key] || [],
      angle: angles[key],
    }));
  }, [liveServices]);

  // Layout computation
  const layout = useMemo(() => {
    const rootRadius = 200;
    const serviceRadius = 120;

    return pRoots.map(root => {
      const rx = CX + Math.cos(root.angle) * rootRadius;
      const ry = CY + Math.sin(root.angle) * rootRadius;

      const serviceNodes = root.services.map((svc, si) => {
        const count = root.services.length || 1;
        const spreadAngle = Math.PI * 0.6;
        const baseAngle = root.angle - spreadAngle / 2;
        const sAngle = count === 1 ? root.angle : baseAngle + (spreadAngle * si) / Math.max(1, count - 1);
        const sx = rx + Math.cos(sAngle) * serviceRadius;
        const sy = ry + Math.sin(sAngle) * serviceRadius;

        const stepNodes = (svc.steps || []).map((step, sti) => {
          const stepSpread = Math.PI * 0.4;
          const stepBase = sAngle - stepSpread / 2;
          const stCount = (svc.steps || []).length;
          const stAngle = stCount === 1 ? sAngle : stepBase + (stepSpread * sti) / Math.max(1, stCount - 1);
          return {
            ...step,
            x: sx + Math.cos(stAngle) * 70,
            y: sy + Math.sin(stAngle) * 70,
            parentX: sx, parentY: sy,
          };
        });

        // Get weight info
        const weight = getServiceWeight(svc.createCategory || svc.taskCategories?.[0]);

        return { ...svc, x: sx, y: sy, parentX: rx, parentY: ry, stepNodes, weight };
      });

      return { ...root, x: rx, y: ry, serviceNodes };
    });
  }, [pRoots]);

  // CRUD Operations
  const updateService = useCallback((serviceKey, updates) => {
    if (ALL_SERVICES[serviceKey]) {
      // Override on a base service
      setOverrides(prev => {
        const next = { ...prev, [serviceKey]: { ...(prev[serviceKey] || {}), ...updates } };
        saveOverrides(next);
        return next;
      });
    } else {
      // Update a custom service
      setCustomServices(prev => {
        const next = { ...prev, [serviceKey]: { ...prev[serviceKey], ...updates } };
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'update', key: serviceKey, updates });
  }, [onConfigChange]);

  const createService = useCallback((newService) => {
    const key = newService.key || `custom_${Date.now()}`;
    const svc = {
      key,
      label: newService.label || 'שירות חדש',
      dashboard: newService.dashboard || 'admin',
      taskCategories: [key],
      createCategory: key,
      steps: [{ key: 'task', label: 'ביצוע', icon: 'check-circle' }],
      ...newService,
    };
    setCustomServices(prev => {
      const next = { ...prev, [key]: svc };
      saveCustomServices(next);
      return next;
    });
    onConfigChange?.({ action: 'create', key, service: svc });
    return key;
  }, [onConfigChange]);

  const deleteService = useCallback((serviceKey) => {
    if (ALL_SERVICES[serviceKey]) {
      // Can't delete base services — just hide via override
      updateService(serviceKey, { _hidden: true });
    } else {
      setCustomServices(prev => {
        const next = { ...prev };
        delete next[serviceKey];
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'delete', key: serviceKey });
    if (selectedServiceKey === serviceKey) setSelectedServiceKey(null);
  }, [onConfigChange, selectedServiceKey, updateService]);

  const moveService = useCallback((serviceKey, newDashboard) => {
    updateService(serviceKey, { dashboard: newDashboard });
  }, [updateService]);

  // Get the currently selected service object
  const selectedService = selectedServiceKey ? liveServices[selectedServiceKey] : null;

  const handleRootClick = useCallback((key) => {
    setExpandedRoot(prev => prev === key ? null : key);
    setSelectedServiceKey(null);
  }, []);

  const handleServiceClick = useCallback((svc) => {
    const newKey = selectedServiceKey === svc.key ? null : svc.key;
    setSelectedServiceKey(newKey);
    onSelectService?.(newKey ? { ...svc, _liveServices: liveServices } : null);
  }, [selectedServiceKey, onSelectService, liveServices]);

  const handleAddService = useCallback(() => {
    const branch = expandedRoot || 'P3';
    const dashboard = branch === 'P1' ? 'payroll' : branch === 'P2' ? 'tax' : 'admin';
    const key = createService({ dashboard, label: 'שירות חדש' });
    setSelectedServiceKey(key);
  }, [expandedRoot, createService]);

  const totalServices = Object.values(liveServices).filter(s => !s._hidden).length;

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
          <radialGradient id="hub-grad">
            <stop offset="0%" stopColor="#2C3E50" />
            <stop offset="100%" stopColor="#1a252f" />
          </radialGradient>
        </defs>

        {/* Branches: center → P-roots */}
        {layout.map(root => (
          <path
            key={`branch-${root.key}`}
            d={buildTaperedBranch(CX, CY, root.x, root.y, 8, 3)}
            fill={root.color} opacity={0.4}
          />
        ))}

        {/* Service branches (expanded root) */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.filter(s => !s._hidden).map(svc => (
            <React.Fragment key={`svc-branch-${svc.key}`}>
              <path
                d={buildTaperedBranch(root.x, root.y, svc.x, svc.y, 4, 1.5)}
                fill={root.color} opacity={0.35}
              />
              {selectedServiceKey === svc.key && svc.stepNodes.map((step, i) => (
                <path
                  key={`step-${svc.key}-${i}`}
                  d={buildTaperedBranch(svc.x, svc.y, step.x, step.y, 2.5, 0.8)}
                  fill={root.color} opacity={0.25}
                />
              ))}
            </React.Fragment>
          ));
        })}

        {/* Center Hub */}
        <circle cx={CX} cy={CY} r={52} fill="url(#hub-grad)" filter="url(#settings-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">CalmPlan</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill="#B0BEC5" fontSize="11">Process Architect</text>
        <text x={CX} y={CY + 22} textAnchor="middle" fill="#78909C" fontSize="9">{totalServices} שירותים</text>

        {/* P-Root Nodes */}
        {layout.map(root => {
          const isExpanded = expandedRoot === root.key;
          const isHovered = hoveredNode === root.key;
          const r = isExpanded ? 52 : 44;
          const visibleCount = root.services.filter(s => !s._hidden).length;
          return (
            <g key={`root-${root.key}`}
              onClick={() => handleRootClick(root.key)}
              onMouseEnter={() => setHoveredNode(root.key)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}>
              {(isHovered || isExpanded) && (
                <circle cx={root.x} cy={root.y} r={r + 6} fill="none"
                  stroke={root.color} strokeWidth={1.5} opacity={0.4}
                  strokeDasharray={isExpanded ? 'none' : '6 3'} />
              )}
              <CloudShape cx={root.x} cy={root.y} r={r} fill={root.bg} stroke={root.color} strokeWidth={2.5} />
              <CloudShape cx={root.x} cy={root.y} r={r - 2} fill="white" stroke="none" strokeWidth={0} opacity={0.85} />
              <text x={root.x} y={root.y - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#263238">{root.key}</text>
              <text x={root.x} y={root.y + 10} textAnchor="middle" fontSize="10" fill={root.color} fontWeight="500">
                {root.label.replace(root.key + ' ', '')}
              </text>
              <text x={root.x} y={root.y + 24} textAnchor="middle" fontSize="8" fill="#90A4AE">{visibleCount} שירותים</text>
            </g>
          );
        })}

        {/* Service Nodes (expanded root) */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.filter(s => !s._hidden).map(svc => {
            const isSelected = selectedServiceKey === svc.key;
            const isCustom = !!customServices[svc.key];
            const r = isSelected ? 34 : 28;
            const cogLoad = svc.weight?.cognitiveLoad || 0;
            return (
              <g key={`svc-${svc.key}`}
                onClick={(e) => { e.stopPropagation(); handleServiceClick(svc); }}
                style={{ cursor: 'pointer' }}>
                {isSelected && (
                  <circle cx={svc.x} cy={svc.y} r={r + 5} fill="none"
                    stroke={root.color} strokeWidth={1.2} opacity={0.5} strokeDasharray="4 3">
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${svc.x} ${svc.y}`} to={`360 ${svc.x} ${svc.y}`}
                      dur="10s" repeatCount="indefinite" />
                  </circle>
                )}
                <BubbleShape cx={svc.x} cy={svc.y} rx={r} fill={root.bg} stroke={root.color} strokeWidth={1.8} />
                <BubbleShape cx={svc.x} cy={svc.y} rx={r - 1.5} fill="white" stroke="none" />
                <text x={svc.x} y={svc.y - 5} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238">
                  {(svc.label || '').substring(0, 14)}
                </text>
                <text x={svc.x} y={svc.y + 7} textAnchor="middle" fontSize="7" fill={root.color}>
                  {(svc.steps || []).length} שלבים
                </text>
                <text x={svc.x} y={svc.y + 16} textAnchor="middle" fontSize="6" fill="#90A4AE">
                  {COGNITIVE_LABELS[cogLoad]} • {svc.weight?.duration || 15}ד׳
                </text>
                {isCustom && (
                  <circle cx={svc.x + r - 4} cy={svc.y - r + 4} r={4} fill="#8BC34A" stroke="white" strokeWidth={1} />
                )}
              </g>
            );
          });
        })}

        {/* Step Nodes (selected service) */}
        {layout.map(root => {
          if (expandedRoot !== root.key) return null;
          return root.serviceNodes.map(svc => {
            if (selectedServiceKey !== svc.key) return null;
            return svc.stepNodes.map((step, i) => (
              <g key={`step-${svc.key}-${i}`}>
                <circle cx={step.x} cy={step.y} r={18} fill={root.bg} stroke={root.color} strokeWidth={1} />
                <circle cx={step.x} cy={step.y} r={16.5} fill="white" stroke="none" />
                <text x={step.x} y={step.y - 1} textAnchor="middle" fontSize="7" fontWeight="500" fill="#37474F">
                  {(step.label || '').substring(0, 10)}
                </text>
                <text x={step.x} y={step.y + 8} textAnchor="middle" fontSize="6" fill="#90A4AE">{i + 1}</text>
              </g>
            ));
          });
        })}

        {/* Add Service button (visible when a root is expanded) */}
        {expandedRoot && (
          <g onClick={handleAddService} style={{ cursor: 'pointer' }}>
            <circle cx={CX} cy={CY + 90} r={18} fill="#8BC34A" stroke="white" strokeWidth={2} />
            <text x={CX} y={CY + 90 + 1} textAnchor="middle" fontSize="20" fontWeight="bold" fill="white">+</text>
            <text x={CX} y={CY + 90 + 15} textAnchor="middle" fontSize="7" fill="#8BC34A">שירות חדש</text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-100">
        {Object.entries(DNA).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-[10px] font-medium" style={{ color: val.color }}>{key}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-100">
        לחץ P לפתוח • לחץ שירות לערוך • + ליצירת שירות חדש
      </div>

      {/* Expose CRUD functions for parent */}
      {selectedService && onSelectService && (() => {
        // Auto-update parent with CRUD capabilities
        const svcWithCrud = {
          ...selectedService,
          _crud: { updateService, deleteService, moveService, createService },
          _liveServices: liveServices,
          _isCustom: !!customServices[selectedServiceKey],
        };
        // Defer to avoid re-render loop
        if (onSelectService._lastKey !== selectedServiceKey) {
          onSelectService._lastKey = selectedServiceKey;
          setTimeout(() => onSelectService(svcWithCrud), 0);
        }
        return null;
      })()}
    </div>
  );
}
