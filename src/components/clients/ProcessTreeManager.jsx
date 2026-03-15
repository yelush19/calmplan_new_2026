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
import { Loader2, Zap, ChevronDown, ChevronLeft, Calendar, GitBranch, Banknote, AlertCircle, FileText, Download, Plus, AlertTriangle, X, Layers } from 'lucide-react';
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
  findOrphanClientNodes,
} from '@/services/processTreeService';
import { getStepsForService } from '@/config/processTemplates';
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

// ── TreeNode — recursive renderer ──
function TreeNode({ node, depth, branchId, clientTree, companyTree, onToggle, onFrequencyChange, onExtraFieldChange, bankAccounts }) {
  const [collapsed, setCollapsed] = useState(depth > 1);
  const [stepsExpanded, setStepsExpanded] = useState(false);
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

  return (
    <div className={depth === 0 ? '' : 'mr-5 border-r border-gray-200 pr-3'}>
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${enabled ? colors.bg : 'bg-gray-50 opacity-60'}`}>
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

        {/* Node label */}
        <span className={`text-sm font-medium flex-1 ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>
          {node.label}
        </span>

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

        {/* Steps count badge */}
        {nodeSteps.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setStepsExpanded(!stepsExpanded); }}
            className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${stepsExpanded ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'}`}
            title="הצג שלבים"
          >
            <Layers className="w-3 h-3" />
            <span className="font-medium">{nodeSteps.length}</span>
          </button>
        )}
      </div>

      {/* Steps list — collapsible */}
      {stepsExpanded && nodeSteps.length > 0 && (
        <div className="mr-10 mt-1 mb-1.5 flex flex-wrap gap-1 px-2 py-1.5 bg-amber-50/50 rounded-md border border-amber-100">
          {nodeSteps.map((step, idx) => (
            <Badge key={step.key || idx} className="bg-white text-amber-700 text-[9px] px-1.5 py-0.5 border border-amber-200 flex items-center gap-1">
              <span className="text-amber-400 font-bold">{idx + 1}</span>
              {step.label}
            </Badge>
          ))}
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
        <div className="mt-0.5">
          {node.children.map(child => (
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
              bankAccounts={bankAccounts}
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
      {Object.entries(companyTree.branches).map(([branchId, branch]) => {
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
          <div key={branchId} className={`border rounded-lg overflow-hidden ${colors.border}`}>
            {/* Branch header */}
            <button
              type="button"
              onClick={() => setExpandedBranches(prev => ({ ...prev, [branchId]: !isExpanded }))}
              className={`w-full flex items-center justify-between px-3 py-2 ${colors.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <span className={`text-sm font-bold ${colors.text}`}>{branchId} | {branch.label}</span>
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
              <div className="p-2 space-y-0.5">
                {(branch.children || []).map(node => (
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
                    bankAccounts={bankAccounts}
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
        <strong>Cascade:</strong> סימון צומת בן מפעיל אוטומטית את ההורה. כיבוי הורה מכבה את כל הבנים.
        <br />
        <strong>תדירות:</strong> ברירת מחדל עוברת בירושה מההורה. שנה ל-Override ספציפי לפי לקוח.
        <br />
        <strong>מע"מ:</strong> שיטת הדיווח קובעת את הדדליין (15 ידני / 19 דיגיטלי / 23 מפורט).
        <br />
        <strong>התאמות:</strong> תדירות נגזרת מהגדרת החשבון בטאב "חשבונות בנק".
      </div>
    </div>
  );
}
