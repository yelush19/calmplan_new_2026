/**
 * SettingsMindMap — Clean Hierarchical Process Map (V4.0)
 *
 * Replaces the chaotic force-directed SVG with a clean, organized tree layout.
 * - Branches in columns (P1–P5)
 * - Nodes as cards with steps shown as chips
 * - Clean SVG connections between levels
 * - Sidebar editor for node details
 * - Full CRUD + DB sync preserved
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ALL_SERVICES,
} from '@/config/processTemplates';
import { SERVICE_WEIGHTS, getServiceWeight } from '@/config/serviceWeights';
import { useDesign } from '@/contexts/DesignContext';
import {
  Trash2, Plus, GripVertical, X, ListOrdered,
  Save, Loader2, ChevronDown, ChevronLeft,
  Circle, Cloud, Diamond, Star, Minus, MessageCircle,
} from 'lucide-react';

import { resolveCategoryLabel } from '@/utils/categoryLabels';
import {
  loadCompanyTree, invalidateTreeCache, saveCompanyTree,
  saveAndBroadcast, onTreeChange,
  loadSettingFromDb, syncSettingToDb,
  ensureMindMapSync,
} from '@/services/processTreeService';
import { toast } from '@/components/ui/use-toast';

// ── DNA Colors (P-branch identity) ──
const BASE_DNA = {
  P1: { color: '#0288D1', label: 'חשבות שכר', bg: '#E1F5FE', glow: '#0288D140', dashboard: 'payroll', gradient: 'from-sky-500 to-blue-600' },
  P2: { color: '#7B1FA2', label: 'הנה"ח ומיסים', bg: '#F3E5F5', glow: '#7B1FA240', dashboard: 'tax', gradient: 'from-purple-500 to-violet-600' },
  P3: { color: '#D81B60', label: 'ניהול', bg: '#FCE4EC', glow: '#D81B6040', dashboard: 'admin', gradient: 'from-pink-500 to-rose-600' },
  P4: { color: '#F9A825', label: 'בית ואישי', bg: '#FFF8E1', glow: '#F9A82540', dashboard: 'home', gradient: 'from-amber-400 to-orange-500' },
  P5: { color: '#2E7D32', label: 'דוחות שנתיים', bg: '#E8F5E9', glow: '#2E7D3240', dashboard: 'annual_reports', gradient: 'from-green-500 to-emerald-600' },
};

const DYNAMIC_COLORS = [
  { color: '#9C27B0', glow: '#9C27B040' },
  { color: '#FF5722', glow: '#FF572240' },
  { color: '#00BCD4', glow: '#00BCD440' },
  { color: '#795548', glow: '#79554840' },
  { color: '#607D8B', glow: '#607D8B40' },
];

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  if (dashboard === 'home') return 'P4';
  if (dashboard === 'annual_reports') return 'P5';
  if (dashboard?.startsWith('P')) return dashboard;
  return 'P3';
}

// ── Persistence helpers ──
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}'); }
  catch { return {}; }
}
function saveOverrides(o) {
  localStorage.setItem('calmplan_service_overrides', JSON.stringify(o));
  syncToSupabase('service_overrides', o);
}
function loadCustomServices() {
  try { return JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}'); }
  catch { return {}; }
}
function saveCustomServices(c) {
  localStorage.setItem('calmplan_custom_services', JSON.stringify(c));
  syncToSupabase('custom_services', c);
}

async function syncToSupabase(key, data) {
  try { await syncSettingToDb(key, data); } catch (err) {
    console.warn(`[Supabase] Failed to sync ${key}:`, err.message);
  }
}

// ── Shape palette ──
const PALETTE_SHAPES = [
  { key: 'cloud', label: 'ענן', icon: Cloud },
  { key: 'bubble', label: 'בועה', icon: Circle },
  { key: 'diamond', label: 'מעוין', icon: Diamond },
  { key: 'pill', label: 'כמוסה', icon: Minus },
  { key: 'star', label: 'כוכב', icon: Star },
  { key: 'hexagon', label: 'משושה', icon: MessageCircle },
];

const COLOR_GRID = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4',
  '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107',
  '#FF9800', '#FF5722', '#795548', '#607D8B',
  '#F48FB1', '#CE93D8', '#B39DDB', '#9FA8DA', '#90CAF9', '#81D4FA',
  '#80DEEA', '#80CBC4', '#A5D6A7', '#C5E1A5', '#E6EE9C', '#FFE082',
  '#FFCC80', '#FFAB91', '#BCAAA4', '#B0BEC5',
];

const COGNITIVE_LABELS = ['ננו', 'פשוט', 'בינוני', 'מורכב'];

// ══════════════════════════════════════════════════════════════════════
// SortableStepsManager — Drag-to-reorder, editable, add/delete steps
// ══════════════════════════════════════════════════════════════════════

function SortableStepsManager({ steps, serviceKey, updateService, color, bg }) {
  const [stepDrag, setStepDrag] = useState(null);
  const [dropPreview, setDropPreview] = useState(null);
  const dragYRef = useRef(0);
  const listRef = useRef(null);

  const commitSteps = useCallback((newSteps) => {
    updateService(serviceKey, { steps: newSteps });
  }, [serviceKey, updateService]);

  const handleStepLabelChange = useCallback((index, newLabel) => {
    const updated = steps.map((s, i) => i === index ? { ...s, label: newLabel } : s);
    commitSteps(updated);
  }, [steps, commitSteps]);

  const handleAddStep = useCallback(() => {
    commitSteps([...steps, { key: `step_${Date.now()}`, label: '', icon: 'check-circle' }]);
  }, [steps, commitSteps]);

  const handleDeleteStep = useCallback((index) => {
    if (steps.length <= 1) return;
    commitSteps(steps.filter((_, i) => i !== index));
  }, [steps, commitSteps]);

  const handleDragStart = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    dragYRef.current = e.clientY;
    setStepDrag({ fromIndex: index, currentIndex: index });
    setDropPreview(index);

    const handleMove = (moveE) => {
      const deltaY = moveE.clientY - dragYRef.current;
      const indexShift = Math.round(deltaY / 36);
      const newIndex = Math.max(0, Math.min(steps.length - 1, index + indexShift));
      setStepDrag(prev => prev ? { ...prev, currentIndex: newIndex } : null);
      setDropPreview(newIndex);
    };

    const handleUp = () => {
      setStepDrag(prev => {
        if (prev && prev.fromIndex !== prev.currentIndex) {
          const reordered = [...steps];
          const [moved] = reordered.splice(prev.fromIndex, 1);
          reordered.splice(prev.currentIndex, 0, moved);
          commitSteps(reordered);
        }
        return null;
      });
      setDropPreview(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [steps, commitSteps]);

  const displaySteps = useMemo(() => {
    if (!stepDrag || stepDrag.fromIndex === stepDrag.currentIndex) return steps;
    const preview = [...steps];
    const [moved] = preview.splice(stepDrag.fromIndex, 1);
    preview.splice(stepDrag.currentIndex, 0, moved);
    return preview;
  }, [steps, stepDrag]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
          <ListOrdered className="w-4 h-4" />
          שלבי תהליך ({steps.length})
        </label>
      </div>
      <div ref={listRef} className="space-y-1">
        {displaySteps.map((step, i) => {
          const isBeingDragged = stepDrag && i === stepDrag.currentIndex;
          return (
            <div
              key={`${step.key || i}-${i}`}
              className={`flex items-center gap-1.5 rounded-xl transition-all ${
                isBeingDragged ? 'bg-blue-50 shadow-sm ring-2 ring-blue-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
              style={{ padding: '6px 8px', minHeight: '38px' }}
            >
              <button className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-500"
                onMouseDown={(e) => handleDragStart(i, e)}>
                <GripVertical className="w-4 h-4" />
              </button>
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: bg, color }}>
                {i + 1}
              </span>
              <input type="text" value={step.label || ''} onChange={(e) => handleStepLabelChange(i, e.target.value)}
                placeholder="שם שלב..." dir="rtl"
                className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-0 border-b border-transparent focus:border-gray-300 focus:outline-none text-gray-700 placeholder-gray-300 font-medium" />
              <button onClick={() => handleDeleteStep(i)}
                className={`flex-shrink-0 p-1 rounded ${steps.length <= 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                disabled={steps.length <= 1}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={handleAddStep}
        className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
        <Plus className="w-4 h-4" />
        הוסף שלב
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TreeNodeCard — Single node in the hierarchical tree
// ══════════════════════════════════════════════════════════════════════

function TreeNodeCard({ node, branchColor, branchBg, isSelected, onClick, depth = 0 }) {
  const stepCount = node.steps?.length || 0;
  const hasChildren = node.children?.length > 0;
  const [expanded, setExpanded] = useState(true);

  const depthIndent = depth * 20;
  const isGroupNode = node.is_parent_task && hasChildren;

  return (
    <div className="relative" style={{ paddingRight: `${depthIndent}px` }}>
      {/* Connection line to parent */}
      {depth > 0 && (
        <div className="absolute top-5 w-4 border-t-2 border-dashed"
          style={{ right: `${depthIndent - 16}px`, borderColor: branchColor + '40' }} />
      )}

      {/* Node card */}
      <div
        onClick={() => onClick(node)}
        className={`group relative rounded-xl border-2 transition-all cursor-pointer mb-2 ${
          isSelected
            ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-2 ring-blue-200'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }`}
        style={{
          borderRightWidth: '4px',
          borderRightColor: branchColor,
        }}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Expand/collapse for group nodes */}
              {isGroupNode && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 flex-shrink-0"
                >
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              )}

              {/* Node color dot */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: branchColor }} />

              {/* Node label */}
              <span className={`font-bold truncate ${isGroupNode ? 'text-base text-gray-900' : 'text-sm text-gray-800'}`}>
                {node.label}
              </span>
            </div>

            {/* Step count badge */}
            {stepCount > 0 && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: branchBg, color: branchColor }}>
                {stepCount} שלבים
              </span>
            )}
          </div>

          {/* Steps as chips */}
          {stepCount > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.steps.map((step, i) => (
                <span key={step.key || i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border"
                  style={{
                    backgroundColor: branchBg,
                    borderColor: branchColor + '30',
                    color: branchColor,
                  }}>
                  <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: branchColor + 'BB' }}>
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              ))}
            </div>
          )}

          {/* Frequency / extra info */}
          {node.default_frequency && node.default_frequency !== 'monthly' && (
            <div className="mt-1.5 text-[10px] text-gray-400 font-medium">
              {node.default_frequency === 'bimonthly' ? 'דו-חודשי' :
               node.default_frequency === 'yearly' ? 'שנתי' :
               node.default_frequency === 'daily' ? 'יומי' :
               node.default_frequency === 'weekly' ? 'שבועי' : node.default_frequency}
            </div>
          )}
        </div>
      </div>

      {/* Children (recursive) */}
      {isGroupNode && expanded && (
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute top-0 bottom-4 w-0.5"
            style={{ right: `${depthIndent + 12}px`, backgroundColor: branchColor + '25' }} />
          {node.children.map(child => (
            <TreeNodeCard
              key={child.id}
              node={child}
              branchColor={branchColor}
              branchBg={branchBg}
              isSelected={isSelected && false}
              onClick={onClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function SettingsMindMap({ onSelectService, onConfigChange }) {
  const design = useDesign();
  const [overrides, setOverrides] = useState(loadOverrides);
  const [customServices, setCustomServices] = useState(loadCustomServices);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dbBranches, setDbBranches] = useState({});
  const [mapSaving, setMapSaving] = useState(false);
  const [dbTreeRef, setDbTreeRef] = useState({ tree: null, configId: null });
  const [collapsedBranches, setCollapsedBranches] = useState(new Set());

  // ── Mount: Reconcile localStorage with Supabase ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureMindMapSync();
      if (cancelled) return;
      const dbOverrides = await loadSettingFromDb('service_overrides');
      if (cancelled) return;
      if (dbOverrides && typeof dbOverrides === 'object' && Object.keys(dbOverrides).length > 0) {
        setOverrides(dbOverrides);
        localStorage.setItem('calmplan_service_overrides', JSON.stringify(dbOverrides));
      }
      const dbCustom = await loadSettingFromDb('custom_services');
      if (cancelled) return;
      if (dbCustom && typeof dbCustom === 'object') {
        setCustomServices(dbCustom);
        localStorage.setItem('calmplan_custom_services', JSON.stringify(dbCustom));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh branches from DB
  const refreshBranchesFromDb = useCallback(async () => {
    invalidateTreeCache();
    try {
      const { tree, configId } = await loadCompanyTree();
      if (!tree?.branches) return;
      setDbTreeRef({ tree, configId });
      const extra = {};
      let dynIdx = 0;
      for (const [branchId, branch] of Object.entries(tree.branches)) {
        if (!BASE_DNA[branchId]) {
          const palette = DYNAMIC_COLORS[dynIdx % DYNAMIC_COLORS.length];
          extra[branchId] = {
            color: palette.color,
            label: `${branchId} ${branch.label}`,
            bg: palette.color + '15',
            glow: palette.glow,
            dashboard: branchId,
          };
          dynIdx++;
        }
      }
      setDbBranches(extra);

      const validBranches = new Set(Object.keys(tree.branches));
      setCustomServices(prev => {
        const cleaned = {};
        let removed = 0;
        for (const [key, svc] of Object.entries(prev)) {
          const branch = getDashboardBranch(svc.dashboard);
          if (validBranches.has(branch) || BASE_DNA[branch]) {
            cleaned[key] = svc;
          } else { removed++; }
        }
        if (removed > 0) saveCustomServices(cleaned);
        return cleaned;
      });
    } catch (err) {
      console.warn('[MindMap] Could not refresh branches:', err);
    }
  }, []);

  useEffect(() => { refreshBranchesFromDb(); }, [refreshBranchesFromDb]);

  // Listen for tree changes from Architect
  useEffect(() => {
    const unsub = onTreeChange(async (detail) => {
      refreshBranchesFromDb();
      const dbCustom = await loadSettingFromDb('custom_services');
      if (dbCustom && typeof dbCustom === 'object') {
        setCustomServices(dbCustom);
        localStorage.setItem('calmplan_custom_services', JSON.stringify(dbCustom));
      }
      const dbOverrides = await loadSettingFromDb('service_overrides');
      if (dbOverrides && typeof dbOverrides === 'object' && Object.keys(dbOverrides).length > 0) {
        setOverrides(dbOverrides);
        localStorage.setItem('calmplan_service_overrides', JSON.stringify(dbOverrides));
      }
    });
    return unsub;
  }, [refreshBranchesFromDb]);

  const DNA = useMemo(() => ({ ...BASE_DNA, ...dbBranches }), [dbBranches]);

  // ── Build the tree data from DB tree ──
  const treeData = useMemo(() => {
    const tree = dbTreeRef.tree;
    if (!tree?.branches) return {};
    return tree.branches;
  }, [dbTreeRef.tree]);

  // ── Build live service registry ──
  const liveServices = useMemo(() => {
    const merged = {};
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      if (overrides[key]?._hidden) continue;
      merged[key] = { ...svc, ...(overrides[key] || {}) };
    }
    for (const [key, svc] of Object.entries(customServices)) {
      if (ALL_SERVICES[key]) continue;
      merged[key] = { ...svc };
    }
    return merged;
  }, [overrides, customServices]);

  // Find selected node in the tree
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !dbTreeRef.tree?.branches) return null;
    const findNode = (nodes) => {
      for (const n of nodes) {
        if (n.id === selectedNodeId || n.service_key === selectedNodeId) return n;
        if (n.children?.length) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    for (const branch of Object.values(dbTreeRef.tree.branches)) {
      const found = findNode(branch.children || []);
      if (found) return found;
    }
    // Also check liveServices
    if (liveServices[selectedNodeId]) {
      const svc = liveServices[selectedNodeId];
      return { id: selectedNodeId, label: svc.label, steps: svc.steps || [], service_key: selectedNodeId, dashboard: svc.dashboard };
    }
    return null;
  }, [selectedNodeId, dbTreeRef.tree, liveServices]);

  // ── CRUD Operations ──
  const updateService = useCallback((serviceKey, updates) => {
    if (ALL_SERVICES[serviceKey]) {
      setOverrides(prev => {
        const next = { ...prev, [serviceKey]: { ...(prev[serviceKey] || {}), ...updates } };
        saveOverrides(next);
        return next;
      });
    } else {
      setCustomServices(prev => {
        const next = { ...prev, [serviceKey]: { ...prev[serviceKey], ...updates } };
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'update', key: serviceKey, updates });
  }, [onConfigChange]);

  const deleteService = useCallback((serviceKey) => {
    if (ALL_SERVICES[serviceKey]) {
      setOverrides(prev => {
        const next = { ...prev, [serviceKey]: { ...(prev[serviceKey] || {}), _hidden: true } };
        saveOverrides(next);
        return next;
      });
    } else {
      setCustomServices(prev => {
        const next = { ...prev };
        delete next[serviceKey];
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'delete', key: serviceKey });
    if (selectedNodeId === serviceKey) setSelectedNodeId(null);
  }, [onConfigChange, selectedNodeId]);

  const moveService = useCallback((serviceKey, newDashboard) => {
    updateService(serviceKey, { dashboard: newDashboard });
  }, [updateService]);

  // ── Handle node click ──
  const handleNodeClick = useCallback((node) => {
    const key = node.service_key || node.id;
    setSelectedNodeId(key);
    if (onSelectService) onSelectService(key);
    design.setActiveTaskId?.(key);
    window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId: key } }));
  }, [onSelectService, design]);

  // ── Toggle branch collapse ──
  const toggleBranch = useCallback((branchId) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }, []);

  // ── Save to DB ──
  const handleSave = useCallback(async () => {
    setMapSaving(true);
    try {
      invalidateTreeCache();
      const { tree, configId: cid } = await loadCompanyTree();
      if (!tree) throw new Error('No tree in DB');
      await saveAndBroadcast(tree, cid, 'MindMap:Save');
      toast({ title: 'נשמר', description: 'המפה נשמרה בהצלחה' });
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
    setMapSaving(false);
  }, []);

  // ── Count total nodes ──
  const totalNodes = useMemo(() => {
    let count = 0;
    const countNodes = (nodes) => {
      for (const n of (nodes || [])) {
        count++;
        if (n.children?.length) countNodes(n.children);
      }
    };
    for (const branch of Object.values(treeData)) {
      countNodes(branch.children);
    }
    return count;
  }, [treeData]);

  // ── Branch display order ──
  const branchOrder = ['P1', 'P2', 'P5', 'P3', 'P4'];
  const sortedBranches = useMemo(() => {
    const allBranchIds = Object.keys(treeData);
    const ordered = [];
    for (const id of branchOrder) {
      if (allBranchIds.includes(id)) ordered.push(id);
    }
    for (const id of allBranchIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    return ordered;
  }, [treeData]);

  // Selected node's branch color
  const selectedBranchColor = useMemo(() => {
    if (!selectedNode) return '#666';
    const findBranch = (branchId, nodes) => {
      for (const n of (nodes || [])) {
        if (n.id === selectedNodeId || n.service_key === selectedNodeId) return branchId;
        if (n.children?.length) {
          const found = findBranch(branchId, n.children);
          if (found) return found;
        }
      }
      return null;
    };
    for (const [branchId, branch] of Object.entries(treeData)) {
      const found = findBranch(branchId, branch.children);
      if (found) return DNA[found]?.color || '#666';
    }
    return '#666';
  }, [selectedNode, selectedNodeId, treeData, DNA]);

  return (
    <div className="relative w-full min-h-[600px]" dir="rtl">
      {/* ══════ Header Bar ══════ */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-l from-gray-50 to-white border-b border-gray-200 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={`${window.location.origin}/logo-litay.png`} alt="" className="w-8 h-8 rounded-full"
              onError={(e) => { e.target.style.display = 'none'; }} />
            <h2 className="text-lg font-black text-gray-800">מפת תהליכים</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
            {totalNodes} צמתים
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch filter chips */}
          {sortedBranches.map(branchId => {
            const dna = DNA[branchId];
            if (!dna) return null;
            const isCollapsed = collapsedBranches.has(branchId);
            return (
              <button
                key={branchId}
                onClick={() => toggleBranch(branchId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                  isCollapsed
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : 'text-white border-transparent shadow-sm'
                }`}
                style={isCollapsed ? {} : { backgroundColor: dna.color }}
              >
                <span className="text-sm">{branchId}</span>
                <span>{treeData[branchId]?.label || dna.label}</span>
              </button>
            );
          })}

          {/* Save button */}
          <button onClick={handleSave} disabled={mapSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm disabled:opacity-50">
            {mapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור
          </button>
        </div>
      </div>

      {/* ══════ Main Content: Tree + Sidebar ══════ */}
      <div className="flex gap-0">
        {/* ── Tree Columns ── */}
        <div className="flex-1 overflow-x-auto">
          <div className={`grid gap-4 p-5 ${
            sortedBranches.filter(id => !collapsedBranches.has(id)).length <= 3
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          }`}>
            {sortedBranches.map(branchId => {
              if (collapsedBranches.has(branchId)) return null;
              const branch = treeData[branchId];
              const dna = DNA[branchId];
              if (!branch || !dna) return null;

              return (
                <div key={branchId} className="min-w-[280px]">
                  {/* Branch header */}
                  <div className="rounded-xl mb-3 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 text-white font-black text-base flex items-center justify-between"
                      style={{ background: `linear-gradient(135deg, ${dna.color}, ${dna.color}DD)` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black opacity-60">{branchId}</span>
                        <span>{branch.label}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold">
                        {(branch.children || []).length} שירותים
                      </span>
                    </div>
                  </div>

                  {/* Branch nodes */}
                  <div className="space-y-0">
                    {(branch.children || []).map(node => (
                      <TreeNodeCard
                        key={node.id}
                        node={node}
                        branchColor={dna.color}
                        branchBg={dna.bg}
                        isSelected={selectedNodeId === node.id || selectedNodeId === node.service_key}
                        onClick={handleNodeClick}
                        depth={0}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════ Sidebar Editor ══════ */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 360 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="border-r border-gray-200 bg-white shadow-lg overflow-hidden flex-shrink-0"
            >
              <div className="w-[360px] h-full overflow-y-auto">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10"
                  style={{ background: `linear-gradient(135deg, ${selectedBranchColor}10, white)` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedBranchColor }} />
                    <span className="text-sm font-bold text-gray-800 truncate">{selectedNode.label}</span>
                  </div>
                  <button onClick={() => setSelectedNodeId(null)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Name edit */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">שם שירות</label>
                    <input type="text" value={selectedNode.label || ''} dir="rtl"
                      onChange={(e) => updateService(selectedNodeId, { label: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-300 focus:outline-none font-medium" />
                  </div>

                  {/* Shape selector */}
                  <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-2">צורה</label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {PALETTE_SHAPES.map(shape => {
                            const ShapeIcon = shape.icon;
                            const isActive = (design.getNodeOverride?.(selectedNodeId)?.shape || design.shape || 'bubble') === shape.key;
                            return (
                              <button key={shape.key}
                                onClick={() => {
                                  design.setNodeOverride?.(selectedNodeId, { shape: shape.key });
                                  updateService(selectedNodeId, { _shape: shape.key });
                                }}
                                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all ${
                                  isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
                                }`}>
                                <ShapeIcon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                <span className={`text-[9px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{shape.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-2">צבע</label>
                        <div className="grid grid-cols-8 gap-1.5">
                          {COLOR_GRID.map(color => {
                            const currentColor = design.getNodeOverride?.(selectedNodeId)?.color || selectedBranchColor;
                            const isActive = currentColor === color;
                            return (
                              <button key={color}
                                onClick={() => {
                                  design.setNodeOverride?.(selectedNodeId, { color });
                                  updateService(selectedNodeId, { _color: color });
                                }}
                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                  isActive ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400 scale-110' : 'border-transparent hover:border-gray-300'
                                }`}
                                style={{ backgroundColor: color }} />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cognitive weight */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">עומס קוגניטיבי</label>
                    <div className="flex items-center gap-1.5">
                      {COGNITIVE_LABELS.map((label, i) => (
                        <button key={i} onClick={() => updateService(selectedNodeId, { _cogOverride: i })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            i === 0 ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Steps Manager */}
                  <SortableStepsManager
                    steps={selectedNode.steps || []}
                    serviceKey={selectedNodeId}
                    updateService={updateService}
                    color={selectedBranchColor}
                    bg={selectedBranchColor + '15'}
                  />

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button onClick={async () => {
                        setMapSaving(true);
                        try {
                          invalidateTreeCache();
                          const { tree, configId: cid } = await loadCompanyTree();
                          if (!tree) throw new Error('No tree');
                          await saveAndBroadcast(tree, cid, 'MindMap:SidebarSave');
                          toast({ title: 'נשמר', description: 'השינויים נשמרו' });
                        } catch (err) {
                          toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
                        }
                        setMapSaving(false);
                      }}
                      disabled={mapSaving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-bold hover:bg-green-100 border-2 border-green-200">
                      {mapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {mapSaving ? 'שומר...' : 'שמור'}
                    </button>
                    <button onClick={() => setDeleteConfirm(selectedNodeId)}
                      className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 border-2 border-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════ Delete Confirmation ══════ */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl p-5 max-w-[280px] border border-red-100">
              <div className="text-center mb-3">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm font-bold text-gray-800">מחיקת שירות</p>
                <p className="text-xs text-gray-500 mt-1">
                  {liveServices[deleteConfirm]?.label || resolveCategoryLabel(deleteConfirm)}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
                  ביטול
                </button>
                <button onClick={() => { deleteService(deleteConfirm); setDeleteConfirm(null); }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600">
                  מחק
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="text-center py-3 text-xs text-gray-400 font-medium border-t border-gray-100">
        לחץ על צומת כדי לערוך פרטים ושלבים בצד
      </div>
    </div>
  );
}
