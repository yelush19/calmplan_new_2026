/**
 * ProcessTreeManager — Client-level Process Tree UI (V3)
 *
 * Renders the company process tree as a hierarchical toggle view.
 * Each node can be enabled/disabled per client, with cascade logic.
 * Supports:
 *   - Frequency overrides and "Full Service" magic button
 *   - VAT reporting method (determines SLA deadline)
 *   - Smart bank reconciliation (linked to client accounts)
 *   - Dynamic tree from DB (Process Architect sync)
 *
 * Used inside ClientForm as a dedicated tab.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, ChevronDown, ChevronLeft, Calendar, GitBranch, Banknote, AlertCircle, FileText, Download, Plus, AlertTriangle, X, Layers, ArrowUp, ArrowDown, Pencil, GripVertical, Trash2, MoveRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  loadCompanyTree,
  resolveFrequency,
  toggleNode,
  isNodeEnabled,
  getEnabledNodeIds,
  applyFullService,
  invalidateTreeCache,
  onTreeChange,
  cleanStaleClientNodes,
  addNodeToCompanyTree,
  updateNodeInCompanyTree,
  moveNodeInCompanyTree,
  deleteNodeFromCompanyTree,
  deduplicateCompanyTree,
  findOrphanClientNodes,
  cleanStaleDependsOn,
} from '@/services/processTreeService';
import { getStepsForService } from '@/config/processTemplates';
import { toast } from '@/components/ui/use-toast';
import { ClientAccount } from '@/api/entities';

// ── Branch colors ──
const BRANCH_COLORS = {
  P1: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  P2: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  P3: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800', dot: 'bg-pink-500' },
  P5: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
};

// Add dynamic colors for P6+ branches
function getBranchColors(branchId) {
  if (BRANCH_COLORS[branchId]) return BRANCH_COLORS[branchId];
  // Dynamic color for user-created branches
  return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' };
}

const FREQUENCY_OPTIONS = [
  { value: 'inherit', label: 'ירושה מהורה' },
  { value: 'monthly', label: 'חודשי' },
  { value: 'bimonthly', label: 'דו-חודשי' },
  { value: 'quarterly', label: 'רבעוני' },
  { value: 'semi_annual', label: 'חצי שנתי' },
  { value: 'yearly', label: 'שנתי' },
  { value: 'not_applicable', label: 'לא רלוונטי' },
];

const FREQUENCY_LABELS = {
  inherit: 'ירושה',
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי',
  yearly: 'שנתי',
  not_applicable: 'לא רלוונטי',
};

// VAT reporting method options with SLA deadlines
const VAT_REPORTING_METHODS = [
  { value: 'periodic_manual', label: 'תקופתי (המחאה/ידני)', sla_day: 15 },
  { value: 'periodic_digital', label: 'תקופתי (דיגיטלי)', sla_day: 19 },
  { value: 'detailed_874', label: 'דיווח מפורט (874)', sla_day: 23 },
];

// ── TreeNode — recursive renderer with two-way editing ──
function TreeNode({ node, depth, branchId, clientTree, companyTree, onToggle, onFrequencyChange, onExtraFieldChange, onNodeUpdate, onNodeMove, onAddChild, onRefresh, bankAccounts, siblingCount, siblingIndex, allBranchNodes, isLastSibling }) {
  const [collapsed, setCollapsed] = useState(depth > 1);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label);
  const [addingStep, setAddingStep] = useState(false);
  const [newStepLabel, setNewStepLabel] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const enabled = isNodeEnabled(clientTree, node.id);
  const hasChildren = node.children && node.children.length > 0;
  // Resolve steps: node.steps from DB tree, fallback to processTemplates via service_key
  const nodeSteps = (node.steps && node.steps.length > 0)
    ? node.steps
    : (node.service_key ? getStepsForService(node.service_key) : []);
  const colors = getBranchColors(branchId);

  // Resolve effective frequency
  const effectiveFreq = useMemo(() => {
    if (!enabled) return null;
    const mockClient = { process_tree: clientTree, reporting_info: {} };
    return resolveFrequency(node.id, mockClient, companyTree);
  }, [node.id, enabled, clientTree, companyTree]);

  const clientOverride = clientTree?.[node.id]?.frequency;
  const hasFrequencyField = !!node.frequency_field || node.frequency_inherit;

  // Check for extra_fields (e.g., VAT reporting method)
  const extraFields = node.extra_fields || {};
  const hasExtraFields = Object.keys(extraFields).length > 0;

  // Smart bank reconciliation link
  const isBankLinked = node.smart_link === 'bank_accounts';
  const activeAccounts = bankAccounts?.filter(a => a.account_status === 'active') || [];

  // ── Save label rename to system settings ──
  const handleSaveLabel = async () => {
    if (labelDraft.trim() && labelDraft !== node.label) {
      try {
        await updateNodeInCompanyTree(node.id, { label: labelDraft.trim() }, 'ProcessTreeManager');
        toast({ title: 'שם עודכן', description: `"${node.label}" → "${labelDraft.trim()}"` });
        onRefresh?.();
      } catch (err) {
        toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
      }
    }
    setEditingLabel(false);
  };

  // ── Add step to this node (syncs to system settings) ──
  const handleAddStep = async () => {
    if (!newStepLabel.trim()) return;
    const updatedSteps = [...nodeSteps, { key: `step_${Date.now()}`, label: newStepLabel.trim() }];
    try {
      await updateNodeInCompanyTree(node.id, { steps: updatedSteps }, 'ProcessTreeManager');
      toast({ title: 'שלב נוסף', description: newStepLabel.trim() });
      setNewStepLabel('');
      setAddingStep(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  };

  // ── Remove step ──
  const handleRemoveStep = async (stepIndex) => {
    const updatedSteps = nodeSteps.filter((_, i) => i !== stepIndex);
    try {
      await updateNodeInCompanyTree(node.id, { steps: updatedSteps }, 'ProcessTreeManager');
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  };

  // ── Move node up/down among siblings ──
  const handleMoveUp = async () => {
    if (siblingIndex <= 0) return;
    try {
      const parentId = node.depends_on?.[0] || branchId;
      await moveNodeInCompanyTree(node.id, parentId, siblingIndex - 1, 'ProcessTreeManager');
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה בהזזה', description: err.message, variant: 'destructive' });
    }
  };

  const handleMoveDown = async () => {
    if (siblingIndex >= siblingCount - 1) return;
    try {
      const parentId = node.depends_on?.[0] || branchId;
      await moveNodeInCompanyTree(node.id, parentId, siblingIndex + 1, 'ProcessTreeManager');
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה בהזזה', description: err.message, variant: 'destructive' });
    }
  };

  // ── Move to different parent (reparent) ──
  const handleMoveTo = async (newParentId) => {
    setShowMoveMenu(false);
    try {
      await moveNodeInCompanyTree(node.id, newParentId, null, 'ProcessTreeManager');
      toast({ title: 'צומת הועבר', description: `"${node.label}" הועבר` });
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה בהעברה', description: err.message, variant: 'destructive' });
    }
  };

  // Get potential parent nodes (all nodes in branch except self and own children)
  const getMovableTargets = () => {
    if (!allBranchNodes) return [];
    const selfAndChildren = new Set();
    const collectIds = (n) => { selfAndChildren.add(n.id); (n.children || []).forEach(collectIds); };
    collectIds(node);
    // Include branch root as an option
    const targets = [{ id: branchId, label: `שורש הענף (${branchId})`, isRoot: true }];
    const collectTargets = (nodes) => {
      for (const n of (nodes || [])) {
        if (!selfAndChildren.has(n.id)) {
          targets.push({ id: n.id, label: n.label });
        }
        if (n.children?.length) collectTargets(n.children);
      }
    };
    collectTargets(allBranchNodes);
    return targets;
  };

  // ── Delete node from tree ──
  const handleDeleteNode = async () => {
    if (!confirm(`למחוק את "${node.label}" וכל הצמתים שמתחתיו?`)) return;
    try {
      await deleteNodeFromCompanyTree(node.id, 'ProcessTreeManager');
      toast({ title: 'צומת נמחק', description: `"${node.label}" הוסר מהעץ` });
      onRefresh?.();
    } catch (err) {
      toast({ title: 'שגיאה במחיקה', description: err.message, variant: 'destructive' });
    }
  };

  // ── Add child node ──
  const handleAddChild = async () => {
    if (!newChildName.trim()) return;
    try {
      await onAddChild(branchId, node.id, newChildName.trim());
      setNewChildName('');
      setAddingChild(false);
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  };

  // Depth-based indentation: each level gets progressively indented
  const depthIndent = depth === 0 ? '' : `mr-${Math.min(depth * 8, 24)}`;

  return (
    <div className={`relative ${depth === 0 ? 'mb-1.5' : 'mb-0.5'}`}>
      {/* Tree connector lines for child nodes */}
      {depth > 0 && (
        <>
          {/* Vertical line from parent — stops at midpoint for last sibling */}
          <div
            className="absolute top-0 border-r-2 border-gray-300"
            style={{
              right: `${(depth - 1) * 32 + 14}px`,
              height: isLastSibling ? '18px' : '100%',
            }}
          />
          {/* Horizontal connector line to this node */}
          <div
            className="absolute top-[18px] h-0 border-t-2 border-gray-300"
            style={{ right: `${(depth - 1) * 32 + 14}px`, width: '18px' }}
          />
        </>
      )}
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors group/treenode relative ${
        depth === 0
          ? (enabled ? `${colors.bg} border-2 ${colors.border} shadow-sm` : 'bg-gray-50 opacity-60 border-2 border-gray-200')
          : depth === 1
            ? (enabled ? `bg-white border border-gray-200 shadow-[inset_3px_0_0_0] shadow-gray-400` : 'bg-gray-50/50 opacity-50 border border-gray-100')
            : (enabled ? `bg-gray-50/60 border border-dashed border-gray-200` : 'bg-gray-50/30 opacity-40 border border-dashed border-gray-100')
      }`}
        style={depth > 0 ? { marginRight: `${depth * 32}px` } : undefined}
      >
        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Enable/disable switch */}
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onToggle(node.id, checked)}
          className="data-[state=checked]:bg-emerald-500"
        />

        {/* Node label — editable */}
        {editingLabel ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              className="h-6 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
              onBlur={handleSaveLabel}
            />
          </div>
        ) : (
          <span
            className={`flex-1 cursor-pointer hover:underline decoration-dashed underline-offset-2 ${
              depth === 0
                ? `text-sm font-black ${enabled ? 'text-gray-900' : 'text-gray-400'}`
                : depth === 1
                  ? `text-[13px] font-semibold ${enabled ? 'text-gray-700' : 'text-gray-400'}`
                  : `text-xs font-normal ${enabled ? 'text-gray-500' : 'text-gray-300'}`
            }`}
            onClick={() => { setLabelDraft(node.label); setEditingLabel(true); }}
            title="לחץ לשינוי שם"
          >
            {depth > 1 && <span className="text-gray-300 ml-1">›</span>}
            {node.label}
          </span>
        )}

        {/* Parent task badge */}
        {node.is_parent_task && (
          <Badge className={`${colors.badge} text-[10px] px-1.5 py-0 border ${colors.border}`}>
            משימת אב
          </Badge>
        )}

        {/* Frequency indicator / override */}
        {enabled && hasFrequencyField && (
          <Select
            value={clientOverride || 'inherit'}
            onValueChange={(val) => onFrequencyChange(node.id, val === 'inherit' ? null : val)}
          >
            <SelectTrigger className="h-6 w-[100px] text-[11px] border-gray-300">
              <Calendar className="w-3 h-3 ml-1 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Show resolved frequency for nodes without direct override */}
        {enabled && !hasFrequencyField && effectiveFreq && (
          <span className="text-[10px] text-gray-400">
            {FREQUENCY_LABELS[effectiveFreq] || effectiveFreq}
          </span>
        )}

        {/* Dependency indicator */}
        {node.depends_on?.length > 0 && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5" title={`תלוי ב: ${node.depends_on.join(', ')}`}>
            <GitBranch className="w-3 h-3" />
          </span>
        )}

        {/* Steps count badge — click to expand/edit */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setStepsExpanded(!stepsExpanded); }}
          className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${stepsExpanded ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'}`}
          title="ערוך שלבים"
        >
          <Layers className="w-3 h-3" />
          <span className="font-medium">{nodeSteps.length}</span>
        </button>

        {/* Move up/down/reparent buttons — visible on hover */}
        <div className="opacity-0 group-hover/treenode:opacity-100 flex items-center gap-0.5 transition-opacity relative">
          {siblingIndex > 0 && (
            <button type="button" onClick={handleMoveUp} className="text-gray-300 hover:text-blue-500" title="הזז למעלה">
              <ArrowUp className="w-3 h-3" />
            </button>
          )}
          {siblingIndex < siblingCount - 1 && (
            <button type="button" onClick={handleMoveDown} className="text-gray-300 hover:text-blue-500" title="הזז למטה">
              <ArrowDown className="w-3 h-3" />
            </button>
          )}
          <button type="button" onClick={() => setShowMoveMenu(!showMoveMenu)} className="text-gray-300 hover:text-violet-500" title="העבר לצומת אחר">
            <MoveRight className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => setAddingChild(!addingChild)} className="text-gray-300 hover:text-emerald-500" title="הוסף צומת בן">
            <Plus className="w-3 h-3" />
          </button>
          <button type="button" onClick={handleDeleteNode} className="text-gray-300 hover:text-red-500" title="מחק צומת">
            <Trash2 className="w-3 h-3" />
          </button>

          {/* Move-to dropdown */}
          {showMoveMenu && (
            <div className="absolute top-6 left-0 z-50 bg-white border-2 border-violet-200 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[200px] overflow-y-auto">
              <div className="text-[10px] font-bold text-gray-500 px-2 py-1 border-b mb-1">העבר "{node.label}" אל:</div>
              {getMovableTargets().map(target => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => handleMoveTo(target.id)}
                  className="w-full text-right px-2 py-1.5 text-xs rounded hover:bg-violet-50 text-gray-700 hover:text-violet-700 transition-colors flex items-center gap-1.5"
                >
                  {target.isRoot ? <GitBranch className="w-3 h-3 text-violet-400" /> : <MoveRight className="w-3 h-3 text-gray-300" />}
                  {target.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowMoveMenu(false)}
                className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 mt-1 pt-1 border-t"
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Steps list — hierarchical flow view */}
      {stepsExpanded && (
        <div className="mr-10 mt-1.5 mb-2 rounded-lg border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white overflow-hidden">
          {/* Steps header */}
          <div className="px-3 py-1.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">שלבי תהליך ({nodeSteps.length})</span>
            <span className="text-[9px] text-amber-500">סדר ביצוע →</span>
          </div>
          <div className="px-2 py-1.5">
            {nodeSteps.map((step, idx) => (
              <div key={step.key || idx} className="group/step relative">
                {/* Connector line */}
                {idx < nodeSteps.length - 1 && (
                  <div className="absolute right-[13px] top-[22px] w-px h-[calc(100%-6px)] bg-amber-300/60" />
                )}
                <div className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-amber-50 transition-colors">
                  {/* Step number circle */}
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black border-2 z-10 ${
                    idx === 0 ? 'bg-amber-500 text-white border-amber-600' :
                    idx === nodeSteps.length - 1 ? 'bg-emerald-500 text-white border-emerald-600' :
                    'bg-white text-amber-700 border-amber-300'
                  }`}>
                    {idx + 1}
                  </div>
                  {/* Step label */}
                  <span className="text-[11px] font-medium text-gray-700 flex-1">{step.label}</span>
                  {/* Phase indicator for first/last */}
                  {idx === 0 && (
                    <span className="text-[8px] text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-full font-bold">התחלה</span>
                  )}
                  {idx === nodeSteps.length - 1 && (
                    <span className="text-[8px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-bold">סיום</span>
                  )}
                  {/* Delete step button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="opacity-0 group-hover/step:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    title="הסר שלב"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Add step */}
          <div className="px-3 py-1.5 border-t border-amber-100">
            {addingStep ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newStepLabel}
                  onChange={(e) => setNewStepLabel(e.target.value)}
                  placeholder="שם שלב חדש..."
                  className="h-6 text-[11px] flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddStep(); if (e.key === 'Escape') setAddingStep(false); }}
                />
                <Button type="button" size="sm" onClick={handleAddStep} disabled={!newStepLabel.trim()} className="h-6 px-2 text-[10px] bg-amber-600 text-white">
                  <Plus className="w-3 h-3" />
                </Button>
                <button type="button" onClick={() => setAddingStep(false)}><X className="w-3 h-3 text-gray-400" /></button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingStep(true)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
              >
                <Plus className="w-3 h-3" /> הוסף שלב
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add child inline form */}
      {addingChild && (
        <div className="mr-10 mt-1 mb-1 flex items-center gap-1">
          <Input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="שם צומת בן..."
            className="h-6 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(); if (e.key === 'Escape') setAddingChild(false); }}
          />
          <Button type="button" size="sm" onClick={handleAddChild} disabled={!newChildName.trim()}
            className="h-6 px-2 text-[10px] bg-emerald-600 text-white">
            <Plus className="w-3 h-3" /> הוסף
          </Button>
          <button type="button" onClick={() => setAddingChild(false)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* VAT Reporting Method — extra field inline */}
      {enabled && hasExtraFields && Object.entries(extraFields).map(([fieldKey, fieldDef]) => {
        if (fieldDef.type !== 'select') return null;
        const currentValue = clientTree?.[node.id]?.[fieldKey] || fieldDef.default_value;
        const selectedOption = fieldDef.options.find(o => o.value === currentValue);
        return (
          <div key={fieldKey} className={`mr-10 mt-1 mb-1 flex items-center gap-2 px-3 py-1.5 rounded-md ${colors.bg} border ${colors.border}`}>
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] text-gray-600 font-medium">{fieldDef.label}:</span>
            <Select
              value={currentValue}
              onValueChange={(val) => onExtraFieldChange(node.id, fieldKey, val)}
            >
              <SelectTrigger className="h-6 w-[180px] text-[11px] border-gray-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldDef.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOption?.sla_day && (
              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                דדליין: {selectedOption.sla_day} לחודש
              </Badge>
            )}
          </div>
        );
      })}

      {/* Smart Bank Reconciliation — show linked accounts */}
      {enabled && isBankLinked && (
        <div className="mr-10 mt-1 mb-1 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 text-[11px]">
            <Banknote className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-700 font-medium">מקושר לחשבונות בנק</span>
            {activeAccounts.length > 0 ? (
              <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                {activeAccounts.length} חשבונות פעילים
              </Badge>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                אין חשבונות — הגדר בטאב חשבונות בנק
              </span>
            )}
          </div>
          {activeAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {activeAccounts.map(acc => (
                <span key={acc.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-[10px] border border-amber-200 text-amber-800">
                  {acc.account_name}
                  <span className="text-amber-500">
                    ({FREQUENCY_LABELS[acc.reconciliation_frequency] || acc.reconciliation_frequency || 'חודשי'})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="mt-0.5 relative">
          {node.children.map((child, childIdx) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              branchId={branchId}
              clientTree={clientTree}
              companyTree={companyTree}
              onToggle={onToggle}
              onFrequencyChange={onFrequencyChange}
              onExtraFieldChange={onExtraFieldChange}
              onNodeUpdate={onNodeUpdate}
              onNodeMove={onNodeMove}
              onAddChild={onAddChild}
              onRefresh={onRefresh}
              bankAccounts={bankAccounts}
              siblingCount={node.children.length}
              siblingIndex={childIdx}
              allBranchNodes={allBranchNodes}
              isLastSibling={childIdx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Process Button — inline input for adding a new process to a branch ──
function AddProcessButton({ branchId, branchColors, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    onAdd(branchId, null, name.trim());
    setName('');
    setOpen(false);
  };

  if (open) {
    return (
      <div className="flex items-center gap-1 mr-7 mt-1 mb-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם תהליך חדש..."
          className="h-6 text-xs w-[180px]"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }}
        />
        <Button type="button" size="sm" onClick={add} disabled={!name.trim()}
          className="h-6 px-2 text-[10px] bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="w-3 h-3 ml-0.5" /> הוסף
        </Button>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 mr-7 mt-1 mb-1 text-[11px] text-gray-400 hover:text-emerald-600 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" /> הוסף תהליך חדש
    </button>
  );
}

// ── Main Component ──
export default function ProcessTreeManager({ processTree, onChange, clientId, clientName, reportingInfo }) {
  const [companyTree, setCompanyTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [expandedBranches, setExpandedBranches] = useState({ P1: true, P2: true, P3: false, P5: false });
  const [orphanNodes, setOrphanNodes] = useState([]);

  // Load company tree and clean stale client nodes
  const refreshTree = useCallback(async () => {
    invalidateTreeCache();
    try {
      const { tree } = await loadCompanyTree();
      setCompanyTree(tree);
      setLoading(false);
      // Auto-expand any dynamic branches
      if (tree?.branches) {
        const branchKeys = Object.keys(tree.branches);
        setExpandedBranches(prev => {
          const updated = { ...prev };
          for (const k of branchKeys) {
            if (!(k in updated)) updated[k] = false;
          }
          return updated;
        });
      }
      // ORPHAN DETECTION: find client tree nodes not in system tree
      if (tree && processTree && Object.keys(processTree).length > 0) {
        const orphans = findOrphanClientNodes(processTree, tree);
        setOrphanNodes(orphans);
      }
    } catch (err) {
      console.error('[ProcessTreeManager] Failed to load tree:', err);
      setLoading(false);
    }
  }, [processTree, onChange]);

  // Load on mount
  useEffect(() => { refreshTree(); }, []);

  // LISTEN for tree changes from Architect/MindMap → auto-refresh
  useEffect(() => {
    const unsub = onTreeChange((detail) => {
      console.log(`[ProcessTreeManager] 📡 Tree changed (from ${detail.source}) — refreshing...`);
      refreshTree();
    });
    return unsub;
  }, [refreshTree]);

  // Load bank accounts for smart reconciliation node
  useEffect(() => {
    if (!clientId) return;
    ClientAccount.filter({ client_id: clientId }, null, 100)
      .then(accounts => setBankAccounts(accounts || []))
      .catch(err => console.warn('[ProcessTreeManager] Could not load bank accounts:', err));
  }, [clientId]);

  const clientTree = processTree || {};

  const handleToggle = useCallback((nodeId, enabled) => {
    if (!companyTree) return;
    const updated = toggleNode(clientTree, nodeId, enabled, companyTree);
    onChange(updated);
  }, [clientTree, companyTree, onChange]);

  const handleFrequencyChange = useCallback((nodeId, frequency) => {
    const updated = { ...clientTree };
    updated[nodeId] = { ...updated[nodeId], frequency: frequency || undefined };
    // Clean up: remove frequency key if null
    if (!frequency) {
      const { frequency: _, ...rest } = updated[nodeId];
      updated[nodeId] = rest;
    }
    onChange(updated);
  }, [clientTree, onChange]);

  const handleExtraFieldChange = useCallback((nodeId, fieldKey, value) => {
    const updated = { ...clientTree };
    updated[nodeId] = { ...updated[nodeId], [fieldKey]: value };
    onChange(updated);
  }, [clientTree, onChange]);

  const handleFullService = useCallback(() => {
    const updated = applyFullService(clientTree);
    onChange(updated);
  }, [clientTree, onChange]);

  const handleClearAll = useCallback(() => {
    onChange({});
  }, [onChange]);

  // Add a new process: creates node in company tree (system settings) AND enables it for this client
  const handleAddProcess = useCallback(async (branchId, parentNodeId, name) => {
    try {
      const { newNodeId } = await addNodeToCompanyTree(branchId, parentNodeId, { label: name }, 'ProcessTreeManager');
      // Enable the new node for this client
      const updated = { ...clientTree, [newNodeId]: { enabled: true } };
      // Also enable parent if specified
      if (parentNodeId) {
        updated[parentNodeId] = { ...updated[parentNodeId], enabled: true };
      }
      onChange(updated);
      // Refresh tree to pick up new node
      await refreshTree();
    } catch (err) {
      console.error('[ProcessTreeManager] Failed to add process:', err);
    }
  }, [clientTree, onChange, refreshTree]);

  // Dismiss orphan nodes by removing them from client tree
  const handleDismissOrphans = useCallback(() => {
    const { cleaned } = cleanStaleClientNodes(clientTree, companyTree);
    onChange(cleaned);
    setOrphanNodes([]);
  }, [clientTree, companyTree, onChange]);

  const handleExportTree = useCallback(async () => {
    const { exportClientProcessTreeCSV } = await import('@/api/functions');
    const mockClient = {
      name: clientName || 'לקוח',
      process_tree: clientTree,
      reporting_info: reportingInfo || {},
    };
    await exportClientProcessTreeCSV(mockClient);
  }, [clientTree, clientName, reportingInfo]);

  const handleDedup = useCallback(async () => {
    try {
      const { removedCount } = await deduplicateCompanyTree('ProcessTreeManager');
      if (removedCount > 0) {
        toast({ title: 'ניקוי כפילויות', description: `הוסרו ${removedCount} צמתים כפולים` });
        await refreshTree();
      } else {
        toast({ title: 'ניקוי כפילויות', description: 'לא נמצאו כפילויות' });
      }
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  }, [refreshTree]);

  const handleCleanDeps = useCallback(async () => {
    try {
      const { fixedCount } = await cleanStaleDependsOn('ProcessTreeManager');
      if (fixedCount > 0) {
        toast({ title: 'תיקון קישורים', description: `תוקנו ${fixedCount} קישורי זרימה` });
        await refreshTree();
      } else {
        toast({ title: 'תיקון קישורים', description: 'לא נמצאו קישורים שגויים' });
      }
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  }, [refreshTree]);

  const enabledCount = getEnabledNodeIds(clientTree).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="mr-2 text-sm text-gray-500">טוען עץ תהליכים...</span>
      </div>
    );
  }

  if (!companyTree) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        לא ניתן לטעון את עץ התהליכים. בדוק חיבור ל-Supabase.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            {enabledCount} צמתים פעילים
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDedup}
            className="text-xs h-7 text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            🧹 נקה כפילויות
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCleanDeps}
            className="text-xs h-7 text-violet-600 border-violet-300 hover:bg-violet-50"
          >
            🔗 תקן קישורים
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-xs h-7"
            disabled={enabledCount === 0}
          >
            נקה הכל
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportTree}
            className="text-xs h-7"
            disabled={enabledCount === 0}
          >
            <Download className="w-3.5 h-3.5 ml-1" />
            ייצוא CSV
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleFullService}
            className="text-xs h-7 bg-gradient-to-l from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600"
          >
            <Zap className="w-3.5 h-3.5 ml-1" />
            Full Service
          </Button>
        </div>
      </div>

      {/* Orphan nodes warning */}
      {orphanNodes.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-800">
              נמצאו {orphanNodes.length} צמתים שלא קיימים בהגדרות מערכת
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              צמתים אלו קיימים בכרטיס הלקוח אך לא במפת התהליכים. ניתן ליצור אותם בהגדרות מערכת או להסיר אותם.
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {orphanNodes.map(id => (
                <Badge key={id} className="bg-amber-100 text-amber-800 text-[9px]">{id}</Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleDismissOrphans}>
                הסר צמתים מיותרים
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Branch sections */}
      {Object.entries(companyTree.branches).filter(([branchId]) => branchId !== 'P4').map(([branchId, branch]) => {
        const colors = getBranchColors(branchId);
        const isExpanded = expandedBranches[branchId] !== false;
        const branchEnabledCount = (branch.children || []).reduce((count, node) => {
          const countEnabled = (n) => {
            let c = isNodeEnabled(clientTree, n.id) ? 1 : 0;
            (n.children || []).forEach(child => { c += countEnabled(child); });
            return c;
          };
          return count + countEnabled(node);
        }, 0);

        return (
          <div key={branchId} className={`border-2 rounded-xl overflow-hidden ${colors.border} shadow-sm`}>
            {/* Branch header */}
            <button
              type="button"
              onClick={() => setExpandedBranches(prev => ({ ...prev, [branchId]: !isExpanded }))}
              className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                <span className={`text-base font-black ${colors.text}`}>{branchId} | {branch.label}</span>
                {branchEnabledCount > 0 && (
                  <Badge className={`${colors.badge} text-[10px] px-1.5 py-0`}>
                    {branchEnabledCount} פעילים
                  </Badge>
                )}
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronLeft className="w-4 h-4 text-gray-400" />}
            </button>

            {/* Branch children */}
            {isExpanded && (
              <div className="p-3 space-y-1 bg-white">
                {(branch.children || []).map((node, nodeIdx) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    branchId={branchId}
                    clientTree={clientTree}
                    companyTree={companyTree}
                    onToggle={handleToggle}
                    onFrequencyChange={handleFrequencyChange}
                    onExtraFieldChange={handleExtraFieldChange}
                    onAddChild={handleAddProcess}
                    onRefresh={refreshTree}
                    bankAccounts={bankAccounts}
                    siblingCount={(branch.children || []).length}
                    siblingIndex={nodeIdx}
                    allBranchNodes={branch.children || []}
                  />
                ))}
                <AddProcessButton branchId={branchId} branchColors={colors} onAdd={handleAddProcess} />
              </div>
            )}
          </div>
        );
      })}

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>עריכה דו-כיוונית:</strong> לחצי על שם צומת לשנות אותו • לחצי על מספר השלבים לערוך/להוסיף שלבים • כל שינוי נשמר להגדרות מערכת.
        <br />
        <strong>הזזה:</strong> חיצי למעלה/למטה (בריחוף) מזיזים צמתים • + מוסיף צומת בן.
        <br />
        <strong>Cascade:</strong> סימון צומת בן מפעיל אוטומטית את ההורה. כיבוי הורה מכבה את כל הבנים.
      </div>
    </div>
  );
}
