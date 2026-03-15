/**
 * ProcessArchitect — Dynamic Process Tree Editor
 *
 * Allows the user to:
 *   - View & edit the company process tree (branches, nodes, steps)
 *   - Add new branches (P6, P7, ...)
 *   - Add/remove/rename child nodes under any branch
 *   - Edit steps for each node
 *   - Configure frequency, dependencies, and extra fields
 *   - Save changes to DB (calmplan_system_config)
 *   - Changes sync immediately to all client cards
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Plus, Trash2, Save, ChevronDown, ChevronLeft, GripVertical,
  Pencil, Check, X, Network, Loader2, AlertTriangle, CheckCircle,
  GitBranch, Calendar, Layers, Settings2, ArrowRightLeft, ToggleRight
} from 'lucide-react';
import {
  loadCompanyTree,
  saveCompanyTree,
  invalidateTreeCache,
  saveAndBroadcast,
  onTreeChange,
  syncSettingToDb,
  getLastSyncResult,
} from '@/services/processTreeService';
import { flattenTree } from '@/config/companyProcessTree';
import { getStepsForService } from '@/config/processTemplates';
import { toast } from '@/components/ui/use-toast';

// ── Branch color palette for dynamic branches ──
const BRANCH_PALETTE = [
  { color: '#00A3E0', icon: '💰' }, // P1 blue
  { color: '#4682B4', icon: '📊' }, // P2 steel blue
  { color: '#E91E63', icon: '📋' }, // P3 pink
  { color: '#2E7D32', icon: '📈' }, // P5 green
  { color: '#9C27B0', icon: '🔮' }, // P6 purple
  { color: '#FF5722', icon: '🔥' }, // P7 deep orange
  { color: '#00BCD4', icon: '🌊' }, // P8 cyan
  { color: '#795548', icon: '🏗️' }, // P9 brown
];

function getColorForBranch(branchId, index) {
  const knownColors = { P1: '#00A3E0', P2: '#4682B4', P3: '#E91E63', P5: '#2E7D32' };
  if (knownColors[branchId]) return knownColors[branchId];
  return BRANCH_PALETTE[(index || 0) % BRANCH_PALETTE.length].color;
}

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'חודשי' },
  { value: 'bimonthly', label: 'דו-חודשי' },
  { value: 'quarterly', label: 'רבעוני' },
  { value: 'semi_annual', label: 'חצי שנתי' },
  { value: 'yearly', label: 'שנתי' },
];

// ── Inline editable text ──
function InlineEdit({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-6 text-sm px-1 w-[200px]"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
        />
      </div>
    );
  }

  return (
    <span
      className={`cursor-pointer hover:underline decoration-dashed underline-offset-2 ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="לחץ לעריכה"
    >
      {value}
      <Pencil className="w-3 h-3 inline mr-1 opacity-0 group-hover/node:opacity-50" />
    </span>
  );
}

// ── Steps editor for a node ──
function StepsEditor({ steps, onChange }) {
  const [newStep, setNewStep] = useState('');

  const addStep = () => {
    if (!newStep.trim()) return;
    const key = `step_${Date.now()}`;
    onChange([...steps, { key, label: newStep.trim() }]);
    setNewStep('');
  };

  const removeStep = (idx) => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const renameStep = (idx, newLabel) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], label: newLabel };
    onChange(updated);
  };

  return (
    <div className="space-y-2 mt-2 mr-6 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <div className="flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-medium text-gray-600">שלבים ({steps.length})</span>
      </div>
      {steps.map((step, idx) => (
        <div key={step.key || idx} className="flex items-center gap-2 group/step">
          <GripVertical className="w-3 h-3 text-gray-300" />
          <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 shrink-0">{idx + 1}</Badge>
          <InlineEdit
            value={step.label}
            onSave={(val) => renameStep(idx, val)}
            className="text-xs text-gray-700 flex-1"
          />
          <button
            onClick={() => removeStep(idx)}
            className="opacity-0 group-hover/step:opacity-100 text-gray-300 hover:text-red-500 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          placeholder="הוסף שלב חדש..."
          className="flex-1 h-6 text-xs"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addStep} disabled={!newStep.trim()} className="h-6 w-6 p-0">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Extra Fields Editor ──
function ExtraFieldsEditor({ extraFields, onChange }) {
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [editingFieldKey, setEditingFieldKey] = useState(null);

  const fields = extraFields || {};

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    const key = `field_${Date.now()}`;
    onChange({
      ...fields,
      [key]: {
        type: 'select',
        label: newFieldLabel.trim(),
        options: [],
        default_value: '',
      },
    });
    setNewFieldLabel('');
    setAddingField(false);
    setEditingFieldKey(key);
  };

  const removeField = (key) => {
    const updated = { ...fields };
    delete updated[key];
    onChange(updated);
  };

  const addOption = (fieldKey) => {
    if (!newOptionLabel.trim()) return;
    const field = fields[fieldKey];
    const value = newOptionLabel.trim().replace(/\s+/g, '_').toLowerCase();
    const updatedOptions = [...(field.options || []), { value, label: newOptionLabel.trim() }];
    onChange({ ...fields, [fieldKey]: { ...field, options: updatedOptions } });
    setNewOptionLabel('');
  };

  const removeOption = (fieldKey, optIdx) => {
    const field = fields[fieldKey];
    const updatedOptions = field.options.filter((_, i) => i !== optIdx);
    onChange({ ...fields, [fieldKey]: { ...field, options: updatedOptions } });
  };

  return (
    <div className="mr-6 mt-1 mb-1 p-2 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2">
      <div className="flex items-center gap-2">
        <Settings2 className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-[10px] font-bold text-purple-700">שדות נוספים ({Object.keys(fields).length})</span>
      </div>
      {Object.entries(fields).map(([key, field]) => (
        <div key={key} className="bg-white rounded p-2 border border-purple-100 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700 flex-1">{field.label}</span>
            <button onClick={() => setEditingFieldKey(editingFieldKey === key ? null : key)} className="text-purple-400 hover:text-purple-600">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => removeField(key)} className="text-gray-300 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </div>
          {editingFieldKey === key && (
            <div className="space-y-1 mt-1">
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px]">
                  <Badge className="bg-purple-100 text-purple-700 text-[9px]">{opt.label}</Badge>
                  <button onClick={() => removeOption(key, i)} className="text-gray-300 hover:text-red-500">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1">
                <Input
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  placeholder="אפשרות חדשה..."
                  className="h-5 text-[10px] flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(key); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => addOption(key)} disabled={!newOptionLabel.trim()} className="h-5 w-5 p-0">
                  <Plus className="w-2.5 h-2.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {addingField ? (
        <div className="flex gap-1">
          <Input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder="שם השדה..." className="h-6 text-[10px] flex-1" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addField(); if (e.key === 'Escape') setAddingField(false); }} />
          <Button type="button" size="sm" onClick={addField} disabled={!newFieldLabel.trim()} className="h-6 px-2 text-[9px] bg-purple-600 text-white">הוסף</Button>
          <button onClick={() => setAddingField(false)}><X className="w-3 h-3 text-gray-400" /></button>
        </div>
      ) : (
        <button onClick={() => setAddingField(true)} className="text-[10px] text-purple-500 hover:text-purple-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> הוסף שדה
        </button>
      )}
    </div>
  );
}

// ── Single node editor (recursive) ──
function NodeEditor({ node, depth, branchId, branchColor, onUpdate, onRemove, allNodeIds, onMoveNode, allBranchIds, allNodesFlat, onOpenEditor }) {
  const [collapsed, setCollapsed] = useState(depth > 0);
  const [showSteps, setShowSteps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const hasChildren = node.children && node.children.length > 0;
  const hasExtraFields = node.extra_fields && Object.keys(node.extra_fields).length > 0;

  // Resolve steps: use node.steps first, fallback to processTemplates via service_key
  const resolvedSteps = (node.steps && node.steps.length > 0)
    ? node.steps
    : (node.service_key ? getStepsForService(node.service_key) : []);
  const isInheritedSteps = resolvedSteps.length > 0 && (!node.steps || node.steps.length === 0);

  // Build list of all descendants to prevent circular move
  const getDescendantIds = (n) => {
    const ids = new Set([n.id]);
    (n.children || []).forEach(c => { getDescendantIds(c).forEach(id => ids.add(id)); });
    return ids;
  };
  const descendantIds = showMoveMenu ? getDescendantIds(node) : new Set();

  const updateField = (field, value) => {
    onUpdate({ ...node, [field]: value });
  };

  const updateChild = (index, updatedChild) => {
    const children = [...(node.children || [])];
    children[index] = updatedChild;
    onUpdate({ ...node, children });
  };

  const removeChild = (index) => {
    const children = (node.children || []).filter((_, i) => i !== index);
    onUpdate({ ...node, children });
  };

  const addChild = () => {
    if (!newChildName.trim()) return;
    const nodeKey = `${branchId}_${newChildName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0590-\u05FF]/g, '')}`;
    const id = `${branchId}_custom_${Date.now()}`;
    const newChild = {
      id,
      label: newChildName.trim(),
      service_key: nodeKey,
      is_parent_task: false,
      default_frequency: node.default_frequency || 'monthly',
      frequency_field: null,
      frequency_fallback: null,
      frequency_inherit: true,
      depends_on: [node.id],
      execution: 'sequential',
      is_collector: false,
      children: [],
      steps: [],
    };
    onUpdate({ ...node, children: [...(node.children || []), newChild] });
    setNewChildName('');
    setAddingChild(false);
  };

  return (
    <div className={depth > 0 ? 'mr-6 border-r-2 pr-4' : ''} style={depth > 0 ? { borderColor: branchColor + '40' } : {}}>
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group/node">
        {/* Collapse */}
        {hasChildren ? (
          <button type="button" onClick={() => setCollapsed(!collapsed)} className="w-7 h-7 flex items-center justify-center rounded-md border-2 transition-colors" style={{ borderColor: branchColor + '60', color: branchColor, backgroundColor: collapsed ? branchColor + '15' : 'transparent' }}>
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        ) : <div className="w-7" />}

        {/* Color dot */}
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: branchColor }} />

        {/* Editable label */}
        <InlineEdit
          value={node.label}
          onSave={(val) => updateField('label', val)}
          className="text-base font-semibold text-gray-800 flex-1"
        />

        {/* Parent badge */}
        {node.is_parent_task && (
          <Badge className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 border-blue-200">אב</Badge>
        )}

        {/* Frequency inherit badge */}
        {node.frequency_inherit && (
          <Badge className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500">ירושה</Badge>
        )}

        {/* Extra fields badge */}
        {hasExtraFields && (
          <Badge className="text-xs px-2 py-0.5 bg-purple-50 text-purple-500">{Object.keys(node.extra_fields).length} שדות</Badge>
        )}

        {/* Frequency */}
        <Select value={node.default_frequency || 'monthly'} onValueChange={(val) => updateField('default_frequency', val)}>
          <SelectTrigger className="h-7 w-[90px] text-sm border-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-1 transition-colors ${showSettings ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
          title="הגדרות מתקדמות"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        {/* Steps toggle + inline badges */}
        <button
          type="button"
          onClick={() => setShowSteps(!showSteps)}
          className={`text-sm flex items-center gap-1 transition-colors ${showSteps ? 'text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
          title="ערוך שלבים"
        >
          <Layers className="w-4 h-4" />
          {resolvedSteps.length > 0 && <span className="font-semibold">{resolvedSteps.length}</span>}
          {isInheritedSteps && <span className="text-xs text-blue-400 mr-0.5">T</span>}
        </button>
        {/* Inline step labels (always visible when steps exist) */}
        {!showSteps && resolvedSteps.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-[280px]">
            {resolvedSteps.slice(0, 4).map((step, i) => (
              <Badge key={step.key || i} className={`text-xs px-1.5 py-0.5 border whitespace-nowrap ${isInheritedSteps ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {step.label}
              </Badge>
            ))}
            {resolvedSteps.length > 4 && (
              <Badge className="bg-gray-50 text-gray-500 text-xs px-1.5 py-0.5 border border-gray-200">
                +{resolvedSteps.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Open side panel editor */}
        {onOpenEditor && (
          <button
            type="button"
            onClick={() => onOpenEditor(node.id, branchId)}
            className="px-2 py-1 rounded-md text-xs font-bold border-2 transition-all hover:shadow-sm"
            style={{ borderColor: branchColor, color: branchColor, backgroundColor: branchColor + '10' }}
            title="ערוך בחלון צידי"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Add child */}
        <button
          type="button"
          onClick={() => setAddingChild(!addingChild)}
          className="text-green-500 hover:text-green-700 transition-all"
          title="הוסף צומת בן"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Move node (re-parent) */}
        {onMoveNode && (
          <button
            type="button"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="text-blue-400 hover:text-blue-600 transition-all"
            title="העבר לאב אחר"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        )}

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-all"
          title="מחק צומת"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Move menu — supports move to branch root OR under specific parent node */}
      {showMoveMenu && onMoveNode && (
        <div className="mr-9 mt-1 mb-1 p-2 rounded-lg border-2 border-blue-200 bg-blue-50 space-y-2 max-h-[300px] overflow-y-auto">
          <span className="text-[10px] font-bold text-blue-700">העבר ל:</span>
          {/* Quick move to branch root */}
          <div>
            <span className="text-[9px] text-gray-500">שורש ענף:</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {(allBranchIds || []).filter(b => b !== branchId).map(targetBranch => (
                <Button key={targetBranch} type="button" variant="outline" size="sm"
                  className="h-5 px-2 text-[9px]"
                  onClick={() => { onMoveNode(node, branchId, targetBranch, null); setShowMoveMenu(false); }}>
                  {targetBranch}
                </Button>
              ))}
            </div>
          </div>
          {/* Move under specific parent node */}
          <div>
            <span className="text-[9px] text-gray-500">תחת צומת אב:</span>
            <Input
              value={moveSearch}
              onChange={(e) => setMoveSearch(e.target.value)}
              placeholder="חפש צומת..."
              className="h-5 text-[10px] mt-0.5"
              autoFocus
            />
            <div className="mt-1 space-y-0.5 max-h-[180px] overflow-y-auto">
              {(allNodesFlat || [])
                .filter(n => n.id !== node.id && !descendantIds.has(n.id))
                .filter(n => !moveSearch || n.label.includes(moveSearch) || n.id.includes(moveSearch))
                .map(target => (
                  <button
                    key={target.id}
                    type="button"
                    className="w-full text-right text-[10px] px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1.5 transition-colors"
                    onClick={() => { onMoveNode(node, branchId, target._branchId, target.id); setShowMoveMenu(false); setMoveSearch(''); }}
                  >
                    <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-500 shrink-0">{target._branchId}</Badge>
                    <span className="truncate">{target.label}</span>
                    <span className="text-[8px] text-gray-400 shrink-0">{target.id}</span>
                  </button>
                ))
              }
            </div>
          </div>
          <button onClick={() => { setShowMoveMenu(false); setMoveSearch(''); }} className="text-[9px] text-gray-400 hover:text-gray-600">ביטול</button>
        </div>
      )}

      {/* Advanced settings panel */}
      {showSettings && (
        <div className="mr-9 mt-1 mb-1 p-2 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={!!node.is_parent_task} onCheckedChange={(val) => updateField('is_parent_task', val)} />
              <span className="text-[10px] text-gray-600">משימת אב</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!node.frequency_inherit} onCheckedChange={(val) => updateField('frequency_inherit', val)} />
              <span className="text-[10px] text-gray-600">ירושת תדירות</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 shrink-0">ביצוע:</span>
            <Select value={node.execution || 'sequential'} onValueChange={(val) => updateField('execution', val)}>
              <SelectTrigger className="h-5 text-[10px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential" className="text-xs">סדרתי</SelectItem>
                <SelectItem value="parallel" className="text-xs">מקבילי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 shrink-0">שדה תדירות:</span>
            <Input
              value={node.frequency_field || ''}
              onChange={(e) => updateField('frequency_field', e.target.value || null)}
              placeholder="לא מוגדר"
              className="h-5 text-[10px] flex-1"
            />
          </div>
          {/* Extra fields editor */}
          <ExtraFieldsEditor
            extraFields={node.extra_fields || {}}
            onChange={(ef) => updateField('extra_fields', Object.keys(ef).length > 0 ? ef : undefined)}
          />
        </div>
      )}

      {/* Steps editor */}
      {showSteps && (
        <StepsEditor
          steps={node.steps || []}
          onChange={(steps) => updateField('steps', steps)}
        />
      )}

      {/* Add child form */}
      {addingChild && (
        <div className="mr-9 mt-1 mb-1 flex items-center gap-2 p-2 rounded-lg border-2 border-dashed" style={{ borderColor: branchColor + '60', backgroundColor: branchColor + '08' }}>
          <Input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="שם צומת בן חדש..."
            className="flex-1 h-7 text-xs border-0 bg-transparent focus-visible:ring-0"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addChild(); if (e.key === 'Escape') setAddingChild(false); }}
          />
          <Button type="button" size="sm" onClick={addChild} disabled={!newChildName.trim()}
            className="h-6 px-2 text-[10px] text-white" style={{ backgroundColor: branchColor }}>
            <Plus className="w-3 h-3 ml-0.5" /> הוסף
          </Button>
          <button onClick={() => setAddingChild(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="mt-0.5">
          {node.children.map((child, idx) => (
            <NodeEditor
              key={child.id}
              node={child}
              depth={depth + 1}
              branchId={branchId}
              branchColor={branchColor}
              onUpdate={(updated) => updateChild(idx, updated)}
              onRemove={() => removeChild(idx)}
              allNodeIds={allNodeIds}
              onMoveNode={onMoveNode}
              allBranchIds={allBranchIds}
              allNodesFlat={allNodesFlat}
              onOpenEditor={onOpenEditor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function ProcessArchitect() {
  const [tree, setTree] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // 'success' | 'error' | null
  const [isDirty, setIsDirty] = useState(false);

  // Add branch state
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchLabel, setNewBranchLabel] = useState('');

  // Side panel editor state
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingBranchId, setEditingBranchId] = useState(null);

  // Load tree
  useEffect(() => {
    invalidateTreeCache();
    loadCompanyTree().then(({ tree: loadedTree, configId: cId }) => {
      setTree(loadedTree);
      setConfigId(cId);
      setLoading(false);
    }).catch(err => {
      console.error('[ProcessArchitect] Failed to load:', err);
      setLoading(false);
    });
  }, []);

  // Listen for tree changes from MindMap / other sources → refresh if not dirty
  useEffect(() => {
    const unsub = onTreeChange((detail) => {
      if (detail.source === 'ProcessArchitect') return; // skip own events
      if (isDirty) return; // don't overwrite unsaved local changes
      console.log(`[ProcessArchitect] 📡 Tree changed (from ${detail.source}) — refreshing...`);
      invalidateTreeCache();
      loadCompanyTree().then(({ tree: t, configId: c }) => {
        setTree(t);
        setConfigId(c);
      });
    });
    return unsub;
  }, [isDirty]);

  // All node IDs for dependency selection
  const allNodeIds = tree ? flattenTree(tree).map(n => n.id) : [];

  // All nodes flat with branch info (for move-to-parent picker)
  const allNodesFlat = useMemo(() => {
    if (!tree?.branches) return [];
    const result = [];
    const collect = (nodes, branchId) => {
      for (const n of (nodes || [])) {
        result.push({ ...n, _branchId: branchId });
        if (n.children?.length) collect(n.children, branchId);
      }
    };
    for (const [branchId, branch] of Object.entries(tree.branches)) {
      collect(branch.children, branchId);
    }
    return result;
  }, [tree]);

  const handleUpdateBranch = useCallback((branchId, updatedBranch) => {
    setTree(prev => ({
      ...prev,
      branches: { ...prev.branches, [branchId]: updatedBranch },
    }));
    setIsDirty(true);
  }, []);

  const handleUpdateNode = useCallback((branchId, nodeIndex, updatedNode) => {
    setTree(prev => {
      const branch = { ...prev.branches[branchId] };
      const children = [...branch.children];
      children[nodeIndex] = updatedNode;
      branch.children = children;
      return { ...prev, branches: { ...prev.branches, [branchId]: branch } };
    });
    setIsDirty(true);
  }, []);

  const handleRemoveNode = useCallback(async (branchId, nodeIndex) => {
    const updatedTree = { ...tree, branches: { ...tree.branches } };
    const branch = { ...updatedTree.branches[branchId] };
    const removedNode = branch.children[nodeIndex];
    branch.children = branch.children.filter((_, i) => i !== nodeIndex);
    updatedTree.branches[branchId] = branch;
    setTree(updatedTree);

    // Collect all service keys from removed node (including nested children)
    const collectKeys = (node) => {
      const keys = [node.service_key || node.id];
      for (const child of (node.children || [])) keys.push(...collectKeys(child));
      return keys;
    };
    const removedKeys = removedNode ? collectKeys(removedNode) : [];

    // Immediately hide removed services in MindMap (custom_services + overrides)
    try {
      const customStr = localStorage.getItem('calmplan_custom_services');
      const customs = customStr ? JSON.parse(customStr) : {};
      const overridesStr = localStorage.getItem('calmplan_service_overrides');
      const overridesLocal = overridesStr ? JSON.parse(overridesStr) : {};
      let changed = false;

      for (const key of removedKeys) {
        // Remove from custom_services
        if (customs[key]) {
          delete customs[key];
          changed = true;
        }
        // Hide in overrides (for template services)
        if (!overridesLocal[key]?._hidden) {
          overridesLocal[key] = { ...(overridesLocal[key] || {}), _hidden: true };
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem('calmplan_custom_services', JSON.stringify(customs));
        localStorage.setItem('calmplan_service_overrides', JSON.stringify(overridesLocal));
        syncSettingToDb('custom_services', customs);
        syncSettingToDb('service_overrides', overridesLocal);
        console.log(`[ProcessArchitect] 🧹 Cleaned ${removedKeys.length} removed services from MindMap`);
      }
    } catch (e) { console.warn('[ProcessArchitect] Cleanup after removal failed:', e); }

    // AUTO-SAVE: node deletion persists immediately
    try {
      setSaving(true);
      const { configId: newConfigId } = await saveAndBroadcast(updatedTree, configId, 'ProcessArchitect');
      setConfigId(newConfigId);
      setIsDirty(false);
      toast({ title: 'צומת נמחק', description: `"${removedNode?.label || removedNode?.id}" נמחק ונשמר` });
    } catch (err) {
      console.error('[ProcessArchitect] Auto-save after node removal failed:', err);
      setIsDirty(true);
    }
    setSaving(false);
  }, [tree, configId]);

  const handleAddNodeToBranch = useCallback((branchId, nodeName) => {
    const id = `${branchId}_custom_${Date.now()}`;
    const newNode = {
      id,
      label: nodeName,
      service_key: id,
      is_parent_task: false,
      default_frequency: 'monthly',
      frequency_field: null,
      frequency_fallback: null,
      frequency_inherit: false,
      depends_on: [],
      execution: 'sequential',
      is_collector: false,
      children: [],
      steps: [],
    };
    setTree(prev => {
      const branch = { ...prev.branches[branchId] };
      branch.children = [...branch.children, newNode];
      return { ...prev, branches: { ...prev.branches, [branchId]: branch } };
    });
    setIsDirty(true);
  }, []);

  const handleAddBranch = useCallback(() => {
    if (!newBranchLabel.trim()) return;
    // Find next branch ID
    const existingKeys = Object.keys(tree.branches);
    const nums = existingKeys.map(k => parseInt(k.replace('P', ''), 10)).filter(n => !isNaN(n));
    const nextNum = Math.max(...nums, 0) + 1;
    // Skip P4 (personal)
    const branchId = nextNum === 4 ? `P${nextNum + 1}` : `P${nextNum}`;

    const newBranch = {
      id: branchId,
      label: newBranchLabel.trim(),
      color_var: `--cp-p${nextNum}`,
      children: [],
    };
    setTree(prev => ({
      ...prev,
      branches: { ...prev.branches, [branchId]: newBranch },
    }));
    setNewBranchLabel('');
    setAddingBranch(false);
    setIsDirty(true);
  }, [newBranchLabel, tree]);

  const handleRemoveBranch = useCallback(async (branchId) => {
    if (!window.confirm(`למחוק את ענף ${branchId} וכל הצמתים שבו?`)) return;

    // Update local state
    const updatedTree = { ...tree, branches: { ...tree.branches } };
    delete updatedTree.branches[branchId];
    setTree(updatedTree);

    // AUTO-SAVE immediately — branch deletion is destructive, must persist to DB
    try {
      setSaving(true);
      const { configId: newConfigId } = await saveAndBroadcast(updatedTree, configId, 'ProcessArchitect');
      setConfigId(newConfigId);
      setIsDirty(false);
      toast({ title: `ענף ${branchId} נמחק`, description: 'השינויים נשמרו ל-DB ומסונכרנים בכל המערכת' });

      // Clean MindMap's localStorage: remove custom services for the deleted branch
      try {
        const customStr = localStorage.getItem('calmplan_custom_services');
        if (customStr) {
          const customs = JSON.parse(customStr);
          const validBranches = new Set(Object.keys(updatedTree.branches));
          const baseBranches = ['P1', 'P2', 'P3', 'P4', 'P5'];
          const cleaned = {};
          let removed = 0;
          for (const [key, svc] of Object.entries(customs)) {
            const dashboard = svc.dashboard || '';
            const parentBranch = svc.parentId || '';
            const brId = dashboard.startsWith('P') ? dashboard : parentBranch.match(/^P\d+/)?.[0];
            if (!brId || validBranches.has(brId) || baseBranches.includes(brId)) {
              cleaned[key] = svc;
            } else {
              removed++;
            }
          }
          if (removed > 0) {
            localStorage.setItem('calmplan_custom_services', JSON.stringify(cleaned));
            syncSettingToDb('custom_services', cleaned);
            console.log(`[ProcessArchitect] Cleaned ${removed} orphan services after branch deletion`);
          }
        }
      } catch (e) { /* non-critical */ }
    } catch (err) {
      console.error('[ProcessArchitect] Auto-save after branch deletion failed:', err);
      toast({ title: 'שגיאה', description: 'המחיקה בוצעה מקומית אך לא נשמרה ל-DB. נסה לשמור ידנית.', variant: 'destructive' });
      setIsDirty(true);
    }
    setSaving(false);
  }, [tree, configId]);

  const handleMoveNode = useCallback(async (node, fromBranch, toBranch, targetParentId) => {
    setTree(prev => {
      const updated = { ...prev, branches: { ...prev.branches } };
      // Remove from source (deep search across all branches)
      const removeFromChildren = (children) =>
        children.filter(n => n.id !== node.id).map(n =>
          n.children?.length ? { ...n, children: removeFromChildren(n.children) } : n
        );
      // Remove from source branch
      const sourceBranch = { ...updated.branches[fromBranch] };
      sourceBranch.children = removeFromChildren(sourceBranch.children);
      updated.branches[fromBranch] = sourceBranch;

      // Also clean from target branch if different (in case node exists there somehow)
      if (toBranch !== fromBranch) {
        const tb = { ...updated.branches[toBranch] };
        tb.children = removeFromChildren(tb.children);
        updated.branches[toBranch] = tb;
      }

      const movedNode = { ...node, depends_on: targetParentId ? [targetParentId] : [] };

      if (targetParentId) {
        // Add under specific parent node (deep insert)
        const addToParent = (children) =>
          children.map(n => {
            if (n.id === targetParentId) {
              return { ...n, children: [...(n.children || []), movedNode] };
            }
            if (n.children?.length) {
              return { ...n, children: addToParent(n.children) };
            }
            return n;
          });
        const tb = { ...updated.branches[toBranch] };
        tb.children = addToParent(tb.children);
        updated.branches[toBranch] = tb;
      } else {
        // Add to branch root
        const tb = { ...updated.branches[toBranch] };
        tb.children = [...(tb.children || []), movedNode];
        updated.branches[toBranch] = tb;
      }
      return updated;
    });
    setIsDirty(true);
    const targetLabel = targetParentId
      ? allNodesFlat.find(n => n.id === targetParentId)?.label || targetParentId
      : toBranch;
    toast({ title: 'צומת הועבר', description: `"${node.label}" הועבר תחת "${targetLabel}"` });
  }, [allNodesFlat]);

  const handleRenameBranch = useCallback((branchId, newLabel) => {
    setTree(prev => ({
      ...prev,
      branches: {
        ...prev.branches,
        [branchId]: { ...prev.branches[branchId], label: newLabel },
      },
    }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!tree) return;
    setSaving(true);
    setSaveResult(null);
    try {
      // Save AND broadcast to all consumers (MindMap, ClientCard, etc.)
      const { configId: newConfigId } = await saveAndBroadcast(tree, configId, 'ProcessArchitect');
      setConfigId(newConfigId);
      setIsDirty(false);
      setSaveResult('success');
      console.log('[ProcessArchitect] ✅ Saved & broadcasted to all consumers');
      const syncResult = getLastSyncResult();
      if (syncResult?.errors?.length > 0) {
        toast({ title: 'עץ נשמר — סנכרון חלקי', description: `${syncResult.updatedCount} לקוחות עודכנו, ${syncResult.errors.length} נכשלו`, variant: 'destructive' });
      } else if (syncResult?.updatedCount > 0) {
        toast({ title: 'עץ נשמר וסונכרן', description: `${syncResult.updatedCount} כרטיסי לקוח עודכנו אוטומטית` });
      } else {
        toast({ title: 'עץ התהליכים נשמר', description: 'השינויים ישתקפו מיד בכל המערכת' });
      }

      // Clean MindMap's localStorage: remove custom services whose branch was deleted
      try {
        const validBranches = new Set(Object.keys(tree.branches));
        const baseBranches = ['P1', 'P2', 'P3', 'P4', 'P5'];
        const customStr = localStorage.getItem('calmplan_custom_services');
        if (customStr) {
          const customs = JSON.parse(customStr);
          const cleaned = {};
          let removed = 0;
          for (const [key, svc] of Object.entries(customs)) {
            const dashboard = svc.dashboard || '';
            const parentBranch = svc.parentId || '';
            // Keep if dashboard branch or parent branch is still valid
            const branchId = dashboard.startsWith('P') ? dashboard : parentBranch.match(/^P\d+/)?.[0];
            if (!branchId || validBranches.has(branchId) || baseBranches.includes(branchId)) {
              cleaned[key] = svc;
            } else {
              removed++;
            }
          }
          if (removed > 0) {
            localStorage.setItem('calmplan_custom_services', JSON.stringify(cleaned));
            syncSettingToDb('custom_services', cleaned); // keep DB in sync too
            console.log(`[ProcessArchitect] 🧹 Cleaned ${removed} orphan services from localStorage`);
          }
        }
      } catch (e) { /* non-critical cleanup */ }

      setTimeout(() => setSaveResult(null), 3000);
    } catch (err) {
      console.error('[ProcessArchitect] Save failed:', err);
      setSaveResult('error');
      toast({ title: 'שגיאה בשמירה', description: err.message || 'שגיאה לא ידועה', variant: 'destructive' });
    }
    setSaving(false);
  }, [tree, configId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="mr-2 text-sm text-gray-500">טוען עץ תהליכים...</span>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        לא ניתן לטעון את עץ התהליכים. בדוק חיבור ל-Supabase.
      </div>
    );
  }

  const totalNodes = flattenTree(tree).length;

  // Find a node by ID anywhere in the tree (for side panel editor)
  const findNodeInTree = useCallback((nodeId) => {
    if (!tree?.branches) return null;
    const search = (nodes) => {
      for (const n of (nodes || [])) {
        if (n.id === nodeId) return n;
        if (n.children?.length) {
          const found = search(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    for (const [, branch] of Object.entries(tree.branches)) {
      const found = search(branch.children);
      if (found) return found;
    }
    return null;
  }, [tree]);

  // Update a node deep in the tree by ID
  const updateNodeById = useCallback((nodeId, updates) => {
    setTree(prev => {
      const updateDeep = (nodes) =>
        nodes.map(n => {
          if (n.id === nodeId) return { ...n, ...updates };
          if (n.children?.length) return { ...n, children: updateDeep(n.children) };
          return n;
        });

      const branches = {};
      for (const [branchId, branch] of Object.entries(prev.branches)) {
        branches[branchId] = { ...branch, children: updateDeep(branch.children || []) };
      }
      return { ...prev, branches };
    });
    setIsDirty(true);
  }, []);

  const editingNode = editingNodeId ? findNodeInTree(editingNodeId) : null;
  const editingBranchColor = editingBranchId ? getColorForBranch(editingBranchId, Object.keys(tree?.branches || {}).indexOf(editingBranchId)) : '#666';

  return (
    <div className="space-y-4">
      {/* ── Side Panel Editor (Sheet) ── */}
      <Sheet open={!!editingNode} onOpenChange={(open) => { if (!open) { setEditingNodeId(null); setEditingBranchId(null); } }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
          {editingNode && (
            <>
              <SheetHeader className="border-b pb-4 mb-4">
                <SheetTitle className="text-lg font-black flex items-center gap-2" style={{ color: editingBranchColor }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editingBranchColor }} />
                  {editingNode.label}
                </SheetTitle>
                <SheetDescription className="text-sm text-gray-500">
                  {editingBranchId} | {editingNode.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5">
                {/* ── Label ── */}
                <div>
                  <Label className="text-sm font-bold text-gray-700">שם הצומת</Label>
                  <Input
                    value={editingNode.label}
                    onChange={(e) => updateNodeById(editingNodeId, { label: e.target.value })}
                    className="mt-1 text-base"
                  />
                </div>

                {/* ── Frequency ── */}
                <div>
                  <Label className="text-sm font-bold text-gray-700">תדירות ברירת מחדל</Label>
                  <Select value={editingNode.default_frequency || 'monthly'} onValueChange={(val) => updateNodeById(editingNodeId, { default_frequency: val })}>
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <Calendar className="w-4 h-4 ml-2 text-gray-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">תדירות זו תחול על כל לקוח שלא הגדיר דריסה ידנית</p>
                </div>

                {/* ── Toggles ── */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editingNode.is_parent_task} onCheckedChange={(val) => updateNodeById(editingNodeId, { is_parent_task: val })} />
                    <span className="text-sm text-gray-700">משימת אב</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editingNode.frequency_inherit} onCheckedChange={(val) => updateNodeById(editingNodeId, { frequency_inherit: val })} />
                    <span className="text-sm text-gray-700">ירושת תדירות</span>
                  </div>
                </div>

                {/* ── Execution ── */}
                <div>
                  <Label className="text-sm font-bold text-gray-700">מצב ביצוע</Label>
                  <Select value={editingNode.execution || 'sequential'} onValueChange={(val) => updateNodeById(editingNodeId, { execution: val })}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential" className="text-sm">סדרתי</SelectItem>
                      <SelectItem value="parallel" className="text-sm">מקבילי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Frequency Field ── */}
                <div>
                  <Label className="text-sm font-bold text-gray-700">שדה תדירות (מ-reporting_info)</Label>
                  <Input
                    value={editingNode.frequency_field || ''}
                    onChange={(e) => updateNodeById(editingNodeId, { frequency_field: e.target.value || null })}
                    placeholder="לדוגמה: vat_reporting_frequency"
                    className="mt-1 text-sm"
                  />
                </div>

                {/* ── Steps Editor ── */}
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 flex items-center gap-2 border-b border-amber-200">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-700">שלבים ({(editingNode.steps || []).length})</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <StepsEditor
                      steps={editingNode.steps || []}
                      onChange={(steps) => updateNodeById(editingNodeId, { steps })}
                    />
                  </div>
                </div>

                {/* ── Extra Fields Editor ── */}
                <div className="border border-purple-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-purple-50 flex items-center gap-2 border-b border-purple-200">
                    <Settings2 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-bold text-purple-700">שדות נוספים</span>
                  </div>
                  <div className="p-3">
                    <ExtraFieldsEditor
                      extraFields={editingNode.extra_fields || {}}
                      onChange={(ef) => updateNodeById(editingNodeId, { extra_fields: Object.keys(ef).length > 0 ? ef : undefined })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Header */}
      <div className="flex items-center justify-between flex-row-reverse">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#E91E6315] to-[#FFC10715]">
            <Network className="w-5 h-5 text-[#E91E63]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">אדריכל תהליכים</h3>
            <p className="text-xs text-gray-500">
              {Object.keys(tree.branches).length} ענפים • {totalNodes} צמתים
              {isDirty && <span className="text-amber-600 mr-2 font-medium"> • שינויים שלא נשמרו</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveResult === 'success' && (
            <Badge className="bg-green-100 text-green-700 text-xs gap-1">
              <CheckCircle className="w-3 h-3" /> נשמר — ישתקף מיד בכרטיסי לקוח
            </Badge>
          )}
          {saveResult === 'error' && (
            <Badge className="bg-red-100 text-red-700 text-xs gap-1">
              <AlertTriangle className="w-3 h-3" /> שגיאה בשמירה
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddingBranch(!addingBranch)}
            className="text-xs h-8 gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            ענף חדש
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="text-xs h-8 gap-1 bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'שומר...' : 'שמור לDB'}
          </Button>
        </div>
      </div>

      {/* Add branch form */}
      {addingBranch && (
        <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50">
          <Input
            value={newBranchLabel}
            onChange={(e) => setNewBranchLabel(e.target.value)}
            placeholder="שם ענף חדש (לדוגמה: ייעוץ מס, ניהול נכסים...)"
            className="flex-1 h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddBranch(); if (e.key === 'Escape') setAddingBranch(false); }}
          />
          <Button type="button" size="sm" onClick={handleAddBranch} disabled={!newBranchLabel.trim()}
            className="h-8 px-4 text-xs bg-purple-600 text-white hover:bg-purple-700">
            <Plus className="w-3 h-3 ml-1" /> צור ענף
          </Button>
          <button onClick={() => setAddingBranch(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Branch sections */}
      {Object.entries(tree.branches).map(([branchId, branch], branchIdx) => {
        const color = getColorForBranch(branchId, branchIdx);
        const nodeCount = (branch.children || []).reduce((count, n) => {
          const countAll = (node) => 1 + (node.children || []).reduce((s, c) => s + countAll(c), 0);
          return count + countAll(n);
        }, 0);
        const isUserBranch = !['P1', 'P2', 'P3', 'P5'].includes(branchId);

        return (
          <Card key={branchId} className="overflow-hidden" style={{ borderColor: color + '40' }}>
            <CardHeader className="py-2 px-4" style={{ backgroundColor: color + '08' }}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-bold" style={{ color }}>
                  {branchId} |{' '}
                  <InlineEdit
                    value={branch.label}
                    onSave={(val) => handleRenameBranch(branchId, val)}
                    className="inline"
                  />
                </span>
                <Badge variant="outline" className="text-[10px] h-5" style={{ borderColor: color + '40', color }}>
                  {nodeCount} צמתים
                </Badge>
                <div className="flex-1" />
                {/* Add node to branch */}
                <AddNodeButton branchId={branchId} color={color} onAdd={(name) => handleAddNodeToBranch(branchId, name)} />
                {/* Remove branch (only user-created) */}
                {isUserBranch && (
                  <button
                    onClick={() => handleRemoveBranch(branchId)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="מחק ענף"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-2 px-3">
              {(branch.children || []).length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-xs">
                  ענף ריק — לחץ + להוספת צומת
                </div>
              ) : (
                <div className="space-y-0.5">
                  {branch.children.map((node, nodeIdx) => (
                    <NodeEditor
                      key={node.id}
                      node={node}
                      depth={0}
                      branchId={branchId}
                      branchColor={color}
                      onUpdate={(updated) => handleUpdateNode(branchId, nodeIdx, updated)}
                      onRemove={() => handleRemoveNode(branchId, nodeIdx)}
                      allNodeIds={allNodeIds}
                      onMoveNode={handleMoveNode}
                      allBranchIds={Object.keys(tree.branches)}
                      allNodesFlat={allNodesFlat}
                      onOpenEditor={(nodeId, bId) => { setEditingNodeId(nodeId); setEditingBranchId(bId); }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 mb-16">
        <strong>סנכרון:</strong> לאחר שמירה, כל כרטיס לקוח יטען את המבנה המעודכן אוטומטית.
        <br />
        <strong>שלבים:</strong> לחץ על אייקון השלבים (⊞) ליד כל צומת כדי להגדיר Steps.
        <br />
        <strong>ענפים חדשים:</strong> לחץ "ענף חדש" ליצירת P6, P7 וכו'.
      </div>

      {/* ── Floating Save Button ── */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-full shadow-lg text-white text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#2E7D32', boxShadow: '0 4px 20px rgba(46, 125, 50, 0.4)' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'שומר...' : 'שמור שינויים ל-DB'}
            {saveResult === 'success' && <CheckCircle className="w-4 h-4 text-green-200" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Small helper: Add node button with inline input ──
function AddNodeButton({ branchId, color, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    setOpen(false);
  };

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם צומת חדש..."
          className="h-6 text-xs w-[160px]"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }}
        />
        <Button type="button" size="sm" onClick={add} disabled={!name.trim()}
          className="h-6 px-2 text-[10px] text-white" style={{ backgroundColor: color }}>
          <Plus className="w-3 h-3" />
        </Button>
        <button onClick={() => setOpen(false)} className="text-gray-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="w-6 h-6 rounded-lg flex items-center justify-center text-white hover:opacity-80 transition-opacity"
      style={{ backgroundColor: color }}
      title="הוסף צומת"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
}
