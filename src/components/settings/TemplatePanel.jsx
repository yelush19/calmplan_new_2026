/**
 * TemplatePanel: LIVE Contextual Editor for Process Architect
 * Dynamically populates when ANY node is clicked on the map.
 * Full CRUD: edit board, steps, categories, weights, parent.
 * Changes sync immediately to the map state (localStorage persisted).
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Plus, Link2, Layers, ChevronRight, Save,
  CheckCircle, FileText, Trash2, AlertTriangle, Zap, GitBranch,
} from 'lucide-react';
import { getServiceWeight } from '@/config/serviceWeights';

const DNA_COLORS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', color: DNA_COLORS.P1 },
  { key: 'tax', label: 'הנה"ח (P2)', color: DNA_COLORS.P2 },
  { key: 'admin', label: 'ניהול (P3)', color: DNA_COLORS.P3 },
  { key: 'additional', label: 'נוספים (P3)', color: DNA_COLORS.P3 },
];

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
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedStepIdx, setExpandedStepIdx] = useState(null);

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
      _cognitiveLoad: editCogLoad,
      _duration: editDuration,
    });
    setHasChanges(false);
  };

  const markChanged = () => setHasChanges(true);

  const addStep = () => {
    if (!newStepLabel.trim() || !crud) return;
    const key = newStepLabel.trim().toLowerCase().replace(/\s+/g, '_');
    const updated = [...editSteps, { key, label: newStepLabel.trim(), icon: 'check-circle' }];
    setEditSteps(updated);
    setNewStepLabel('');
    crud.updateService(service.key, { steps: updated });
  };

  const removeStep = (index) => {
    if (!crud) return;
    const updated = editSteps.filter((_, i) => i !== index);
    setEditSteps(updated);
    crud.updateService(service.key, { steps: updated });
  };

  const moveStep = (index, direction) => {
    const next = [...editSteps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditSteps(next);
    if (crud) crud.updateService(service.key, { steps: next });
  };

  const toggleNextStep = (stepIndex, targetKey) => {
    if (!crud) return;
    const updated = editSteps.map((s, i) => {
      if (i !== stepIndex) return s;
      const current = s.nextStepIds || [];
      const has = current.includes(targetKey);
      return { ...s, nextStepIds: has ? current.filter(k => k !== targetKey) : [...current, targetKey] };
    });
    setEditSteps(updated);
    crud.updateService(service.key, { steps: updated });
  };

  const addCategory = () => {
    if (!newCategory.trim() || !crud) return;
    const updated = [...editCategories, newCategory.trim()];
    setEditCategories(updated);
    setNewCategory('');
    // Auto-persist immediately — no "שמור" needed
    crud.updateService(service.key, { taskCategories: updated });
  };

  const removeCategory = (index) => {
    if (!crud) return;
    const updated = editCategories.filter((_, i) => i !== index);
    setEditCategories(updated);
    // Auto-persist immediately
    crud.updateService(service.key, { taskCategories: updated });
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

        {/* Board Assignment */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-3.5 h-3.5" style={{ color: pColor }} />
            <span className="text-xs font-bold text-gray-700">שיוך ללוח</span>
          </div>
          <div className="space-y-1.5">
            {BOARD_OPTIONS.map(board => {
              const isMapped = editDashboard === board.key;
              return (
                <button
                  key={board.key}
                  onClick={() => handleBoardChange(board.key)}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border transition-all text-right ${
                    isMapped ? 'border-transparent shadow-sm' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  style={isMapped ? { backgroundColor: board.color + '10', borderColor: board.color + '30' } : {}}
                >
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: isMapped ? board.color : '#E0E0E0' }} />
                  <span className={`text-xs font-medium ${isMapped ? 'text-gray-800' : 'text-gray-500'}`}>{board.label}</span>
                  {isMapped && <CheckCircle className="w-3 h-3 mr-auto" style={{ color: board.color }} />}
                </button>
              );
            })}
          </div>
        </div>

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
            {editSteps.map((step, i) => {
              const isExpanded = expandedStepIdx === i;
              const nextIds = step.nextStepIds || [];
              const otherSteps = editSteps.filter((_, j) => j !== i);
              return (
                <div key={`${step.key}-${i}`} className="space-y-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 group">
                    <div className="w-5 h-5 rounded-full text-[9px] font-bold text-white shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: pColor }}>{i + 1}</div>
                    <Input
                      value={step.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditSteps(prev => prev.map((s, idx) =>
                          idx === i ? { ...s, label: val } : s
                        ));
                        markChanged();
                      }}
                      className="h-7 text-xs font-medium text-gray-700 flex-1 border-0 bg-transparent focus:bg-white focus:ring-1 px-1"
                    />
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setExpandedStepIdx(isExpanded ? null : i)}
                        title="שלב הבא (multi-flow)"
                        className={`p-0.5 rounded ${isExpanded ? 'bg-blue-100 text-blue-600' : 'hover:bg-blue-50 text-gray-400'}`}>
                        <GitBranch className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-3 h-3 rotate-90" /></button>
                      <button onClick={() => moveStep(i, 1)} disabled={i === editSteps.length - 1}
                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-3 h-3 -rotate-90" /></button>
                      <button onClick={() => removeStep(i)}
                        className="p-0.5 rounded hover:bg-red-100 text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {/* Multi-select next steps picker */}
                  {isExpanded && (
                    <div className="mr-7 mt-1 mb-1 px-3 py-2 rounded-lg border border-blue-100 bg-blue-50/30">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <GitBranch className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-700">שלבים הבאים</span>
                        {nextIds.length > 0 && (
                          <Badge variant="outline" className="text-[8px] h-3 px-1 border-blue-300 text-blue-600">{nextIds.length}</Badge>
                        )}
                      </div>
                      {/* Current selections as pills */}
                      {nextIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {nextIds.map(nid => {
                            const target = editSteps.find(s => s.key === nid);
                            return (
                              <Badge key={nid} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 gap-1 cursor-default">
                                {target?.label || nid}
                                <button onClick={() => toggleNextStep(i, nid)} className="hover:text-red-500">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {/* Available steps to add */}
                      <div className="flex flex-wrap gap-1">
                        {otherSteps.filter(s => !nextIds.includes(s.key)).map(s => (
                          <button key={s.key}
                            onClick={() => toggleNextStep(i, s.key)}
                            className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            + {s.label}
                          </button>
                        ))}
                      </div>
                      {otherSteps.length === 0 && (
                        <p className="text-[9px] text-gray-400">אין שלבים נוספים</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
