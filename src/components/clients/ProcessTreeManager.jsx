/**
 * ProcessTreeManager — Client-level Process Tree UI
 *
 * Renders the company process tree as a hierarchical toggle view.
 * Each node can be enabled/disabled per client, with cascade logic.
 * Supports frequency overrides and a "Full Service" magic button.
 *
 * Used inside ClientForm as a dedicated tab.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, ChevronDown, ChevronLeft, Calendar, GitBranch } from 'lucide-react';
import {
  loadCompanyTree,
  resolveFrequency,
  toggleNode,
  isNodeEnabled,
  getEnabledNodeIds,
  applyFullService,
} from '@/services/processTreeService';

// ── Branch colors ──
const BRANCH_COLORS = {
  P1: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  P2: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  P3: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800', dot: 'bg-pink-500' },
  P5: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
};

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

// ── TreeNode — recursive renderer ──
function TreeNode({ node, depth, branchId, clientTree, companyTree, onToggle, onFrequencyChange }) {
  const [collapsed, setCollapsed] = useState(depth > 1);
  const enabled = isNodeEnabled(clientTree, node.id);
  const hasChildren = node.children && node.children.length > 0;
  const colors = BRANCH_COLORS[branchId] || BRANCH_COLORS.P3;

  // Resolve effective frequency
  const effectiveFreq = useMemo(() => {
    if (!enabled) return null;
    const mockClient = { process_tree: clientTree, reporting_info: {} };
    return resolveFrequency(node.id, mockClient, companyTree);
  }, [node.id, enabled, clientTree, companyTree]);

  const clientOverride = clientTree?.[node.id]?.frequency;
  const hasFrequencyField = !!node.frequency_field || node.frequency_inherit;

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
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function ProcessTreeManager({ processTree, onChange }) {
  const [companyTree, setCompanyTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState({ P1: true, P2: true, P3: false, P5: false });

  // Load company tree on mount
  useEffect(() => {
    let mounted = true;
    loadCompanyTree().then(({ tree }) => {
      if (mounted) {
        setCompanyTree(tree);
        setLoading(false);
      }
    }).catch(err => {
      console.error('[ProcessTreeManager] Failed to load tree:', err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

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

  const handleFullService = useCallback(() => {
    const updated = applyFullService(clientTree);
    onChange(updated);
  }, [clientTree, onChange]);

  const handleClearAll = useCallback(() => {
    onChange({});
  }, [onChange]);

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
            size="sm"
            onClick={handleFullService}
            className="text-xs h-7 bg-gradient-to-l from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600"
          >
            <Zap className="w-3.5 h-3.5 ml-1" />
            Full Service
          </Button>
        </div>
      </div>

      {/* Branch sections */}
      {Object.entries(companyTree.branches).map(([branchId, branch]) => {
        const colors = BRANCH_COLORS[branchId] || BRANCH_COLORS.P3;
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
                  />
                ))}
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
      </div>
    </div>
  );
}
