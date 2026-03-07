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
  GitBranch,
} from 'lucide-react';
import { getServiceWeight } from '@/config/serviceWeights';

const DNA_COLORS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

const DNA = {
  P1: { color: '#00A3E0', dashboard: 'payroll' },
  P2: { color: '#B2AC88', dashboard: 'tax' },
  P3: { color: '#E91E63', dashboard: 'admin' },
  P4: { color: '#FFC107', dashboard: 'home' },
};

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', color: DNA_COLORS.P1 },
  { key: 'tax', label: 'הנה"ח (P2)', color: DNA_COLORS.P2 },
  { key: 'admin', label: 'ניהול (P3)', color: DNA_COLORS.P3 },
  { key: 'additional', label: 'נוספים (P3)', color: DNA_COLORS.P3 },
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

// ══════════════════════════════════════════════════════════════════════
// ParentBranchDropdown — Full breadcrumb-path parent selector
// Shows "P1 שכר → שירותים → ייצור" so user knows EXACTLY which parent
// ══════════════════════════════════════════════════════════════════════

function ParentBranchDropdown({ service, editDashboard, onBoardChange, pColor }) {
  const allNodes = service?._allNodes || [];
  const currentParentId = service?.parentId;

  // Build all valid parent targets with full breadcrumb paths
  const parentOptions = useMemo(() => {
    if (!allNodes.length) {
      // Fallback: if no allNodes available, show flat board options
      return BOARD_OPTIONS.map(b => ({
        id: `__board_${b.key}`,
        path: b.label,
        dashboard: b.key,
        color: b.color,
        type: 'board',
        branch: b.key,
      }));
    }

    return allNodes
      .filter(n => n.type === 'root' || (n.type === 'service' && n.id !== service?.key))
      .map(n => ({
        id: n.id,
        path: getNodePath(n.id, allNodes),
        dashboard: getDashboardFromNode(n),
        color: n.color,
        type: n.type,
        branch: n.type === 'root' ? n.id : null,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'root' ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
  }, [allNodes, service?.key]);

  // Current parent breadcrumb path
  const currentPath = useMemo(() => {
    if (!currentParentId || !allNodes.length) {
      const board = BOARD_OPTIONS.find(b => b.key === editDashboard);
      return board?.label || editDashboard;
    }
    return getNodePath(currentParentId, allNodes);
  }, [currentParentId, allNodes, editDashboard]);

  const handleSelect = useCallback((e) => {
    const targetId = e.target.value;

    // Handle fallback board selection
    if (targetId.startsWith('__board_')) {
      const boardKey = targetId.replace('__board_', '');
      onBoardChange(boardKey);
      console.log('STATE MUTATED:', { action: 'reparent_board', key: service?.key, newDashboard: boardKey });
      return;
    }

    const target = allNodes.find(n => n.id === targetId);
    if (!target) return;

    const newDashboard = getDashboardFromNode(target);
    if (newDashboard) {
      onBoardChange(newDashboard);
      console.log('STATE MUTATED:', {
        action: 'reparent',
        key: service?.key,
        fromParent: currentParentId,
        toParent: targetId,
        toPath: getNodePath(targetId, allNodes),
        newDashboard,
      });
    }
  }, [allNodes, service?.key, currentParentId, onBoardChange]);

  return (
    <div className="px-4 py-3 border-b" style={{ border: '3px solid red', borderRadius: '12px', margin: '8px', backgroundColor: '#FFF0F0' }}>
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-3.5 h-3.5" style={{ color: pColor }} />
        <span className="text-xs font-bold text-gray-700">שיוך לענף אב (Breadcrumb Parent)</span>
      </div>

      {/* Current path breadcrumb display */}
      <div className="flex items-center gap-1.5 mb-2 px-3 py-2 rounded-xl border border-dashed"
        style={{ borderColor: pColor + '40', backgroundColor: pColor + '08' }}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
        <span className="text-[11px] font-medium text-gray-700 truncate" dir="rtl" title={currentPath}>
          נוכחי: {currentPath}
        </span>
      </div>

      {/* Breadcrumb path <select> dropdown */}
      <select
        value={currentParentId || `__board_${editDashboard}`}
        onChange={handleSelect}
        className="w-full px-3 py-2 text-xs border-2 rounded-xl focus:ring-2 focus:outline-none bg-white"
        style={{ borderColor: 'red' }}
        dir="rtl"
      >
        <option value="" disabled>-- בחר ענף אב --</option>
        {parentOptions.map(opt => (
          <option key={opt.id} value={opt.id}>
            {opt.type === 'root'
              ? `● ${opt.path}`
              : opt.type === 'board'
                ? opt.path
                : `  └─ ${opt.path}`
            }
          </option>
        ))}
      </select>

      {/* Compact board shortcut buttons */}
      <div className="flex gap-1 mt-2">
        {BOARD_OPTIONS.map(board => {
          const isMapped = editDashboard === board.key;
          return (
            <button
              key={board.key}
              onClick={() => {
                onBoardChange(board.key);
                console.log('STATE MUTATED:', { action: 'reparent_board', key: service?.key, newDashboard: board.key });
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all border ${
                isMapped ? 'text-white shadow-sm border-transparent' : 'border-gray-100 text-gray-400 hover:border-gray-200'
              }`}
              style={isMapped ? { backgroundColor: board.color } : {}}
              title={board.label}
            >
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isMapped ? 'white' : '#D0D0D0' }} />
              {board.label.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Debug: allNodes count */}
      <div className="text-[8px] text-red-400 mt-1">
        DEBUG: allNodes={allNodes.length} | parentId={currentParentId || 'none'} | dashboard={editDashboard}
      </div>
    </div>
  );
}

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
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!service) return null;

  const pColor = editDashboard === 'payroll' ? DNA_COLORS.P1
    : editDashboard === 'tax' ? DNA_COLORS.P2
    : DNA_COLORS.P3;

  const handleSave = () => {
    if (!crud) return;
    crud.updateService(service.key, {
      label: editLabel,
      dashboard: editDashboard,
      steps: editSteps,
      taskCategories: editCategories,
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
    setEditCategories(prev => [...prev, newCategory.trim()]);
    setNewCategory('');
    markChanged();
  };

  const removeCategory = (index) => {
    setEditCategories(prev => prev.filter((_, i) => i !== index));
    markChanged();
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

        {/* ══ Parent Branch Assignment (Breadcrumb Dropdown) ══ */}
        <ParentBranchDropdown
          service={service}
          editDashboard={editDashboard}
          onBoardChange={handleBoardChange}
          pColor={pColor}
        />

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
            <div>לוח: <span className="font-mono">{editDashboard}</span></div>
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
