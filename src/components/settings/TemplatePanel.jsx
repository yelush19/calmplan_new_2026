/**
 * TemplatePanel: LIVE Contextual Editor for Process Architect
 * Dynamically populates when ANY node is clicked on the map.
 * Full CRUD: edit board, steps, categories, weights, parent.
 * Changes sync immediately to the map state (localStorage persisted).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Plus, Link2, Layers, ChevronRight, Save,
  CheckCircle, FileText, Trash2, AlertTriangle, Zap,
  GitBranch, ArrowRight, GitMerge,
} from 'lucide-react';
import { getServiceWeight } from '@/config/serviceWeights';

const DNA_COLORS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
  P5: '#2E7D32',
};

const DNA = {
  P1: { color: '#00A3E0', dashboard: 'payroll' },
  P2: { color: '#B2AC88', dashboard: 'tax' },
  P3: { color: '#E91E63', dashboard: 'admin' },
  P4: { color: '#FFC107', dashboard: 'home' },
  P5: { color: '#2E7D32', dashboard: 'annual_reports' },
};

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', color: DNA_COLORS.P1 },
  { key: 'tax', label: 'הנה"ח (P2)', color: DNA_COLORS.P2 },
  { key: 'admin', label: 'ניהול (P3)', color: DNA_COLORS.P3 },
  { key: 'home', label: 'בית (P4)', color: DNA_COLORS.P4 },
  { key: 'annual_reports', label: 'דוחות שנתיים (P5)', color: DNA_COLORS.P5 },
];

// ══════════════════════════════════════════════════════════════════════
// getNodePath — Breadcrumb path builder for precise re-parenting
// Traverses parent chain: "P1 שכר → שירותים → ייצור"
// ══════════════════════════════════════════════════════════════════════
function getNodePath(nodeId, allNodes, maxDepth = 10) {
  const segments = [];
  let currentId = nodeId;
  let depth = 0;

  while (currentId && currentId !== 'hub' && depth < maxDepth) {
    const node = allNodes.find(n => n.id === currentId);
    if (!node) break;
    segments.unshift(node.label || node.id);
    currentId = node.parentId;
    depth++;
  }

  return segments.join(' \u2192 ');
}

function getDashboardFromNode(node) {
  if (node.type === 'root') return DNA[node.id]?.dashboard;
  return node.dashboard;
}

const COGNITIVE_TIERS = [
  { value: 0, label: 'ננו', color: '#8FBC8F', desc: '5 דקות' },
  { value: 1, label: 'פשוט', color: '#ADD8E6', desc: '15 דקות' },
  { value: 2, label: 'בינוני', color: '#4682B4', desc: '30 דקות' },
  { value: 3, label: 'מורכב', color: '#800000', desc: '45+ דקות' },
];

export default function TemplatePanel({ service, onClose }) {
  const crud = service?._crud;
  const isCustom = service?._isCustom;

  const [editLabel, setEditLabel] = useState(service?.label || '');
  const [editDashboard, setEditDashboard] = useState(service?.dashboard || 'admin');
  const [editSteps, setEditSteps] = useState(service?.steps || []);
  const [editCategories, setEditCategories] = useState(service?.taskCategories || []);
  const [editDuration, setEditDuration] = useState(() => {
    const w = getServiceWeight(service?.createCategory || service?.taskCategories?.[0]);
    return w.duration;
  });
  const [editCogLoad, setEditCogLoad] = useState(() => {
    const w = getServiceWeight(service?.createCategory || service?.taskCategories?.[0]);
    return w.cognitiveLoad;
  });
  const [newStepLabel, setNewStepLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editNextStepIds, setEditNextStepIds] = useState(() => {
    if (service?.nextStepIds?.length) return service.nextStepIds;
    if (service?.nextStepId) return [service.nextStepId];
    return [];
  });
  const [editIsParallel, setEditIsParallel] = useState(service?.isParallel || false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!service) return null;

  const pColor = editDashboard === 'payroll' ? DNA_COLORS.P1
    : editDashboard === 'tax' ? DNA_COLORS.P2
    : editDashboard === 'home' ? DNA_COLORS.P4
    : editDashboard === 'annual_reports' ? DNA_COLORS.P5
    : DNA_COLORS.P3;

  const handleSave = () => {
    if (!crud) return;
    crud.updateService(service.key, {
      label: editLabel,
      dashboard: editDashboard,
      steps: editSteps,
      taskCategories: editCategories,
      nextStepIds: editNextStepIds.length > 0 ? editNextStepIds : [],
      isParallel: editIsParallel,
    });
    setHasChanges(false);
  };

  const markChanged = () => setHasChanges(true);

  const addStep = () => {
    if (!newStepLabel.trim()) return;
    const key = newStepLabel.trim().toLowerCase().replace(/\s+/g, '_');
    setEditSteps(prev => [...prev, { key, label: newStepLabel.trim(), icon: 'check-circle' }]);
    setNewStepLabel('');
    markChanged();
  };

  const removeStep = (index) => {
    setEditSteps(prev => prev.filter((_, i) => i !== index));
    markChanged();
  };

  const moveStep = (index, direction) => {
    setEditSteps(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markChanged();
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    const updated = [...editCategories, newCategory.trim()];
    setEditCategories(updated);
    setNewCategory('');
    // Immediately persist — no "Save" button needed
    if (crud) {
      crud.updateService(service.key, { taskCategories: updated });
      console.log('STATE MUTATED:', { action: 'add_category', key: service.key, category: newCategory.trim(), all: updated });
    }
  };

  const removeCategory = (index) => {
    const updated = editCategories.filter((_, i) => i !== index);
    setEditCategories(updated);
    // Immediately persist
    if (crud) {
      crud.updateService(service.key, { taskCategories: updated });
      console.log('STATE MUTATED:', { action: 'remove_category', key: service.key, removedIndex: index, all: updated });
    }
  };

  const handleDelete = () => {
    if (!crud) return;
    crud.deleteService(service.key);
    onClose?.();
  };

  const handleBoardChange = (newBoard) => {
    setEditDashboard(newBoard);
    markChanged();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed top-0 left-0 bottom-0 w-[360px] bg-white shadow-2xl z-50 overflow-y-auto"
        style={{ borderRight: `4px solid ${pColor}` }}
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: pColor + '15' }}>
                <Layers className="w-4 h-4" style={{ color: pColor }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">עורך שירות</h3>
                <span className="text-[10px] text-gray-400">
                  {service.key} • {editDashboard}
                  {isCustom && <Badge className="text-[8px] h-3 px-1 bg-green-100 text-green-700 mr-1">מותאם</Badge>}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasChanges && (
                <Button size="sm" onClick={handleSave}
                  className="h-7 px-2 text-[10px] gap-1"
                  style={{ backgroundColor: pColor }}>
                  <Save className="w-3 h-3" />
                  שמור
                </Button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Service Name */}
        <div className="px-4 py-3 border-b">
          <label className="text-[10px] font-bold text-gray-500 mb-1 block">שם שירות</label>
          <Input
            value={editLabel}
            onChange={(e) => { setEditLabel(e.target.value); markChanged(); }}
            className="h-9 text-sm font-bold"
            style={{ borderColor: pColor + '40' }}
          />
        </div>

        {/* ══ RED BOX: Cross-Node Parenting + Manual Board Override ══ */}
        {(() => {
          const allNodes = service?._allNodes || [];
          const crudRef = service?._crud;
          const currentKey = service?.key;
          const currentParentId = service?.parentId;

          // Collect descendants of current node to prevent circular loops
          const getDescendants = (nodeId) => {
            const desc = new Set();
            const stack = [nodeId];
            while (stack.length) {
              const id = stack.pop();
              for (const n of allNodes) {
                if (n.parentId === id && !desc.has(n.id)) {
                  desc.add(n.id);
                  stack.push(n.id);
                }
              }
            }
            return desc;
          };
          const descendants = getDescendants(currentKey);

          // ALL nodes except: self, own descendants, step-type nodes
          const candidates = allNodes.filter(n =>
            n.id !== currentKey &&
            !descendants.has(n.id) &&
            n.type !== 'step'
          );

          // Build breadcrumb path for a node
          const buildPath = (nodeId) => {
            const segs = [];
            let cur = nodeId;
            let depth = 0;
            while (cur && cur !== 'hub' && depth < 10) {
              const found = allNodes.find(x => x.id === cur);
              if (!found) break;
              segs.unshift(found.label || found.id);
              cur = found.parentId;
              depth++;
            }
            return segs.join(' \u2192 ');
          };

          // Sort: roots first, then by path
          const sorted = [...candidates].sort((a, b) => {
            if (a.type === 'root' && b.type !== 'root') return -1;
            if (a.type !== 'root' && b.type === 'root') return 1;
            return buildPath(a.id).localeCompare(buildPath(b.id));
          });

          // Current parent breadcrumb
          const currentPath = currentParentId ? buildPath(currentParentId) : '(שורש)';

          // Board options for manual override
          const boardChoices = [
            { key: 'payroll', label: 'שכר (P1)', color: '#00A3E0' },
            { key: 'tax', label: 'הנה"ח (P2)', color: '#B2AC88' },
            { key: 'admin', label: 'ניהול (P3)', color: '#E91E63' },
            { key: 'home', label: 'בית (P4)', color: '#FFC107' },
            { key: 'annual_reports', label: 'דוחות שנתיים (P5)', color: '#2E7D32' },
          ];

          return (
            <div style={{ border: '3px solid red', borderRadius: '12px', margin: '8px', padding: '12px', backgroundColor: '#FFF0F0' }}>
              {/* ── Section 1: Parent Node (Hierarchy) ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <GitBranch style={{ width: '14px', height: '14px', color: 'red' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>שיוך לענף אב (היררכיה)</span>
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px dashed #ccc' }} dir="rtl">
                נוכחי: <strong>{currentPath}</strong>
              </div>

              <select
                value={currentParentId || ''}
                onChange={(e) => {
                  const newParentId = e.target.value;
                  if (!newParentId || !crudRef) return;

                  // TRUE reparenting — ONLY updates parentId, NEVER touches dashboard
                  crudRef.updateService(currentKey, { parentId: newParentId });

                  console.log('STATE MUTATED:', {
                    action: 'reparent_node',
                    key: currentKey,
                    oldParent: currentParentId,
                    newParent: newParentId,
                    newParentPath: buildPath(newParentId),
                  });
                }}
                style={{ width: '100%', padding: '8px 12px', fontSize: '12px', border: '2px solid red', borderRadius: '8px', backgroundColor: 'white', direction: 'rtl' }}
              >
                <option value="" disabled>-- בחר ענף אב --</option>
                {sorted.map(n => {
                  const path = buildPath(n.id);
                  const prefix = n.type === 'root' ? '●' : '└─';
                  const indent = n.type === 'root' ? '' : '   ';
                  return (
                    <option key={n.id} value={n.id}>
                      {indent}{prefix} {path}
                    </option>
                  );
                })}
              </select>

              {/* ── Section 2: Manual Board Override (DECOUPLED from hierarchy) ── */}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e88' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Layers style={{ width: '14px', height: '14px', color: '#E91E63' }} />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>שינוי לוח ראשי</span>
                  <span style={{ fontSize: '9px', color: '#999' }}>(לא תלוי בהיררכיה)</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {boardChoices.map(b => {
                    const isActive = editDashboard === b.key;
                    return (
                      <button
                        key={b.key}
                        onClick={() => {
                          if (!crudRef) return;
                          // Immediately persist board change — decoupled from parent
                          handleBoardChange(b.key);
                          crudRef.updateService(currentKey, { dashboard: b.key });
                          console.log('STATE MUTATED:', {
                            action: 'manual_board_override',
                            key: currentKey,
                            oldDash: editDashboard,
                            newDash: b.key,
                          });
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontWeight: isActive ? 'bold' : 'normal',
                          borderRadius: '16px',
                          border: `2px solid ${b.color}`,
                          backgroundColor: isActive ? b.color : 'white',
                          color: isActive ? 'white' : b.color,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ FLOW & DEPENDENCIES: Next Steps (Multi) + Parallel Toggle ══ */}
        {(() => {
          const allNodes = service?._allNodes || [];
          const crudRef = service?._crud;
          const currentKey = service?.key;

          // Candidates for "next step": all service nodes except self
          const flowCandidates = allNodes.filter(n =>
            n.id !== currentKey && n.type === 'service'
          );

          // Build breadcrumb for display
          const buildPath = (nodeId) => {
            const segs = [];
            let cur = nodeId;
            let depth = 0;
            while (cur && cur !== 'hub' && depth < 10) {
              const found = allNodes.find(x => x.id === cur);
              if (!found) break;
              segs.unshift(found.label || found.id);
              cur = found.parentId;
              depth++;
            }
            return segs.join(' \u2192 ');
          };

          const toggleNextStep = (nodeId) => {
            const isSelected = editNextStepIds.includes(nodeId);
            const updated = isSelected
              ? editNextStepIds.filter(id => id !== nodeId)
              : [...editNextStepIds, nodeId];
            setEditNextStepIds(updated);
            if (crudRef) {
              crudRef.updateService(currentKey, { nextStepIds: updated });
              console.log('STATE MUTATED:', {
                action: 'set_next_steps',
                key: currentKey,
                nextStepIds: updated,
              });
            }
          };

          return (
            <div className="px-4 py-3 border-b" style={{ backgroundColor: '#F0F8FF' }}>
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-bold text-gray-700">זרימה ותלויות</span>
              </div>

              {/* Next Steps Multi-Select */}
              <div className="mb-3">
                <label className="text-[10px] font-bold text-gray-500 mb-1 block">שלבים הבאים (בחר מרובה)</label>
                {editNextStepIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {editNextStepIds.map(id => {
                      const n = allNodes.find(x => x.id === id);
                      return n ? (
                        <span key={id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          <ArrowRight className="w-2.5 h-2.5" />
                          {n.label || n.id}
                          <button onClick={() => toggleNextStep(id)} className="hover:text-red-500">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1.5px solid #90CAF9', borderRadius: '8px', backgroundColor: 'white' }}>
                  {flowCandidates.length === 0 && (
                    <div className="text-[10px] text-gray-400 p-2 text-center">אין צמתים זמינים</div>
                  )}
                  {flowCandidates.map(n => {
                    const isChecked = editNextStepIds.includes(n.id);
                    return (
                      <label key={n.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 cursor-pointer text-[11px]"
                        style={{ direction: 'rtl', borderBottom: '1px solid #f0f0f0' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleNextStep(n.id)}
                          style={{ accentColor: '#1565C0' }} />
                        <span className={isChecked ? 'font-bold text-blue-700' : 'text-gray-600'}>
                          {n.label || n.id}
                        </span>
                        <span className="text-[9px] text-gray-400 mr-auto">{buildPath(n.id)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Parallel Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = !editIsParallel;
                    setEditIsParallel(next);
                    if (crudRef) {
                      crudRef.updateService(currentKey, { isParallel: next });
                      console.log('STATE MUTATED:', {
                        action: 'toggle_parallel',
                        key: currentKey,
                        isParallel: next,
                      });
                    }
                  }}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px', border: 'none',
                    backgroundColor: editIsParallel ? '#4CAF50' : '#ccc',
                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                    position: 'absolute', top: '2px',
                    left: editIsParallel ? '18px' : '2px',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <GitMerge className="w-3.5 h-3.5" style={{ color: editIsParallel ? '#4CAF50' : '#999' }} />
                <span className="text-[10px] font-medium" style={{ color: editIsParallel ? '#4CAF50' : '#999' }}>
                  בצע במקביל (Parallel)
                </span>
              </div>
              {editIsParallel && (
                <div className="mt-1.5 text-[9px] text-green-600 bg-green-50 px-2 py-1 rounded-md">
                  צומת זה יתבצע במקביל לצמתים אחים באותו ענף אב
                </div>
              )}
            </div>
          );
        })()}

        {/* Process Steps (CRUD) */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5" style={{ color: pColor }} />
            <span className="text-xs font-bold text-gray-700">שלבי תהליך</span>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5" style={{ borderColor: pColor, color: pColor }}>
              {editSteps.length}
            </Badge>
          </div>

          <div className="space-y-1.5">
            {editSteps.map((step, i) => (
              <div key={`${step.key}-${i}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 group">
                <div className="w-5 h-5 rounded-full text-[9px] font-bold text-white shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: pColor }}>{i + 1}</div>
                <span className="text-xs font-medium text-gray-700 flex-1">{step.label}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-3 h-3 rotate-90" /></button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === editSteps.length - 1}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-3 h-3 -rotate-90" /></button>
                  <button onClick={() => removeStep(i)}
                    className="p-0.5 rounded hover:bg-red-100 text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Input value={newStepLabel} onChange={(e) => setNewStepLabel(e.target.value)}
              placeholder="הוסף שלב חדש..." className="h-8 text-xs flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addStep()} />
            <Button size="sm" onClick={addStep} disabled={!newStepLabel.trim()}
              className="h-8 px-2" style={{ backgroundColor: pColor }}><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {/* Cognitive Load & Duration */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5" style={{ color: pColor }} />
            <span className="text-xs font-bold text-gray-700">עומס קוגניטיבי</span>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">משך (דקות)</label>
              <Input type="number" value={editDuration}
                onChange={(e) => { setEditDuration(Number(e.target.value)); markChanged(); }}
                className="h-8 text-xs w-24" min={5} max={120} step={5} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">מורכבות</label>
              <div className="flex gap-1">
                {COGNITIVE_TIERS.map(tier => (
                  <button key={tier.value}
                    onClick={() => { setEditCogLoad(tier.value); markChanged(); }}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                      editCogLoad === tier.value ? 'text-white shadow-sm border-transparent' : 'border-gray-100 text-gray-500'
                    }`}
                    style={editCogLoad === tier.value ? { backgroundColor: tier.color } : {}}
                    title={tier.desc}>{tier.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 py-3 border-b">
          <div className="text-xs font-bold text-gray-700 mb-2">קטגוריות משימה</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {editCategories.map((cat, i) => (
              <Badge key={`${cat}-${i}`} variant="outline"
                className="text-[9px] px-2 py-0.5 rounded-full group cursor-default"
                style={{ borderColor: pColor + '40', color: pColor }}>
                {cat}
                <button onClick={() => removeCategory(i)}
                  className="mr-1 opacity-0 group-hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              placeholder="קטגוריה חדשה..." className="h-7 text-[10px] flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
            <Button size="sm" onClick={addCategory} disabled={!newCategory.trim()}
              className="h-7 px-2 text-[10px]" variant="outline"
              style={{ borderColor: pColor + '30', color: pColor }}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="px-4 py-3 border-b bg-gray-50/50">
          <div className="text-[9px] text-gray-400 space-y-0.5">
            <div>מפתח: <span className="font-mono">{service.key}</span></div>
            {service.taskType && <div>סוג: <span className="font-mono">{service.taskType}</span></div>}
            {service.sequentialSteps && <div className="text-amber-600">סדרתי — כל שלב דורש השלמת הקודם</div>}
            {service.supportsComplexity && <div className="text-purple-600">תומך במורכבות</div>}
          </div>
        </div>

        {/* High Complexity Steps */}
        {service.highComplexitySteps?.length > 0 && (
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-bold text-gray-500">שלבים למורכבות גבוהה</span>
            </div>
            <div className="space-y-1">
              {service.highComplexitySteps.map((step, i) => (
                <div key={step.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-100 bg-amber-50/30">
                  <div className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center bg-amber-200 text-amber-700">{i + 1}</div>
                  <span className="text-[10px] text-gray-600">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="px-4 py-3">
          {showDeleteConfirm ? (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50">
              <p className="text-xs text-red-700 mb-2 font-medium">
                {isCustom ? 'למחוק לצמיתות?' : 'להסתיר שירות זה?'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-[10px] gap-1">
                  <Trash2 className="w-3 h-3" />{isCustom ? 'מחק' : 'הסתר'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} className="h-7 text-[10px]">ביטול</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm"
              className="w-full text-xs gap-2 rounded-xl text-red-500 border-red-200 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-3.5 h-3.5" />{isCustom ? 'מחק שירות' : 'הסתר שירות'}
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
