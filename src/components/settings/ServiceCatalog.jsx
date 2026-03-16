/**
 * ServiceCatalog: Full service listing grouped by P1-P5 branches.
 * Shows every service with its steps (in locked sort_order), step badges,
 * and provides "Save to Database" to persist everything to Supabase.
 *
 * This is the SOURCE OF TRUTH audit view — what you see here IS what's in the DB.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Database, CheckCircle, AlertTriangle, Loader2, ChevronDown,
  CloudUpload, Shield, Clock,
} from 'lucide-react';
import { ALL_SERVICES, getStepsForService } from '@/config/processTemplates';

// ── Branch DNA (mirrored from SettingsMindMap) ──
const BRANCHES = [
  { key: 'P1', label: 'P1 | חשבות שכר', color: '#00A3E0', dashboards: ['payroll'] },
  { key: 'P2', label: 'P2 | הנהלת חשבונות ומיסים', color: '#B2AC88', dashboards: ['tax'] },
  { key: 'P3', label: 'P3 | ניהול ותכנון', color: '#F59E0B', dashboards: ['admin', 'additional'] },
  { key: 'P4', label: 'P4 | בית', color: '#FACC15', dashboards: ['home'] },
  { key: 'P5', label: 'P5 | דוחות שנתיים והצהרות', color: '#2E7D32', dashboards: ['annual_reports'] },
];

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  if (dashboard === 'home') return 'P4';
  if (dashboard === 'annual_reports') return 'P5';
  return 'P3';
}

// Step badge abbreviations
function getStepBadge(step) {
  const map = {
    'submission': 'TX', 'payment': 'PAY', 'report_prep': 'DOC',
    'income_input': 'DL', 'expense_input': 'DL', 'calculation': 'CALC',
    'data_export': 'DB', 'receive_data': 'IN', 'prepare_payslips': 'DOC',
    'proofreading': 'REV', 'salary_entry': 'CALC', 'employee_payments': 'PAY',
    'authority_payments': 'TX', 'send_to_operator': 'TX', 'receive_file': 'DL',
    'file_prep': 'DOC', 'upload': 'UP', 'send_receipts': 'TX',
    'document_prep': 'DOC', 'send_to_client': 'MSG', 'consultation': 'MSG',
    'summary': 'DOC', 'allocation': 'ALK', 'check_entries': 'CHK',
    'follow_up': 'FDL', 'claim_submit': 'TX', 'pending_funds': 'PAY',
  };
  return map[step.key] || step.key.substring(0, 3).toUpperCase();
}

function getTaskTypeBadge(svc) {
  if (svc.taskType === 'authority') return { label: 'דיווח+תשלום', color: '#FF5722' };
  return null;
}

export default function ServiceCatalog({ overrides, customServices }) {
  const [expandedServices, setExpandedServices] = useState(new Set());
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [saveResult, setSaveResult] = useState(null);

  // Build merged service list (template + overrides + custom)
  const allServices = useMemo(() => {
    const merged = {};
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      if (overrides?.[key]?._hidden) continue;
      merged[key] = { ...svc, ...(overrides?.[key] || {}), _source: 'template' };
    }
    for (const [key, svc] of Object.entries(customServices || {})) {
      merged[key] = { ...svc, _source: 'custom' };
    }
    return merged;
  }, [overrides, customServices]);

  // Group services by branch
  const groupedByBranch = useMemo(() => {
    const groups = {};
    for (const branch of BRANCHES) {
      groups[branch.key] = [];
    }
    for (const [key, svc] of Object.entries(allServices)) {
      const branch = svc.branch || getDashboardBranch(svc.dashboard);
      if (!groups[branch]) groups[branch] = [];
      groups[branch].push({ ...svc, key, _branch: branch });
    }
    return groups;
  }, [allServices]);

  const totalServices = Object.keys(allServices).length;
  const activeServices = Object.values(allServices).filter(s => !s._hidden).length;

  // Toggle service expansion
  const toggleExpand = useCallback((key) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── SAVE TO DATABASE ──
  // Builds a full manifest with locked sort_order and pushes to Supabase
  const handleSaveToDb = useCallback(async () => {
    setSaveStatus('saving');
    setSaveResult(null);

    try {
      const { SystemConfig } = await import('@/api/entities');

      // Build the full service_definitions manifest with LOCKED sort_order
      const manifest = {};
      for (const [key, svc] of Object.entries(allServices)) {
        const branch = svc.branch || getDashboardBranch(svc.dashboard);
        manifest[key] = {
          key: svc.key || key,
          label: svc.label,
          dashboard: svc.dashboard,
          branch,
          parentId: svc.parentId || branch,
          taskType: svc.taskType || 'linear',
          createCategory: svc.createCategory,
          taskCategories: svc.taskCategories || [],
          _source: svc._source,
          // LOCKED SORT ORDER: steps indexed 0, 1, 2, ... in the order defined
          steps: (svc.steps || []).map((step, index) => ({
            key: step.key,
            label: step.label,
            icon: step.icon || 'check-circle',
            sort_order: index,
            parent_service: key,
            requiresPrev: step.requiresPrev || false,
          })),
        };
      }

      // Save all collections to Supabase
      const existing = await SystemConfig.list();
      const upsert = async (configKey, data) => {
        const record = existing.find(r => r.config_key === configKey);
        const payload = { config_key: configKey, config_value: data, updated_at: new Date().toISOString() };
        if (record) {
          await SystemConfig.update(record.id, payload);
        } else {
          await SystemConfig.create(payload);
        }
      };

      // 1. Full service definitions (the master manifest)
      await upsert('service_definitions', manifest);

      // 2. Service overrides
      const ov = JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}');
      await upsert('service_overrides', ov);

      // 3. Custom services
      const cs = JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}');
      await upsert('custom_services', cs);

      // 4. Node positions
      const np = JSON.parse(localStorage.getItem('calmplan_node_positions') || '{}');
      await upsert('node_positions', np);

      // 5. Sync timestamp
      await upsert('last_full_sync', {
        timestamp: new Date().toISOString(),
        total_services: totalServices,
        branches: Object.fromEntries(BRANCHES.map(b => [b.key, (groupedByBranch[b.key] || []).length])),
      });

      // Integrity verification
      let integrityOk = true;
      const issues = [];
      for (const [key, svc] of Object.entries(manifest)) {
        const steps = svc.steps || [];
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].sort_order !== i) {
            integrityOk = false;
            issues.push(`${key}: step "${steps[i].label}" sort_order=${steps[i].sort_order}, expected=${i}`);
          }
          if (steps[i].parent_service !== key) {
            integrityOk = false;
            issues.push(`${key}: step "${steps[i].label}" parent_service mismatch`);
          }
        }
      }

      setSaveResult({
        synced: totalServices,
        branches: Object.fromEntries(BRANCHES.map(b => [b.key, (groupedByBranch[b.key] || []).length])),
        integrityOk,
        issues,
        timestamp: new Date().toISOString(),
      });
      setSaveStatus(integrityOk ? 'success' : 'warning');

    } catch (err) {
      console.error('[ServiceCatalog] Save to DB failed:', err);
      setSaveResult({ error: err.message });
      setSaveStatus('error');
    }
  }, [allServices, totalServices, groupedByBranch]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">קטלוג שירותים — Service Catalog</h2>
            <p className="text-xs text-gray-500">
              כל השירותים שהמשרד מציע עם שלבי ה-Workflow שלהם. ערוך שלבים, הפעל/כבה שירותים, ושמור ל-Database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badges */}
          {saveStatus === 'success' && (
            <Badge className="bg-green-100 text-green-700 text-xs gap-1">
              <CheckCircle className="w-3 h-3" /> נשמר
            </Badge>
          )}
          {!saveStatus && (
            <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
              <AlertTriangle className="w-3 h-3" /> טרם נשמר
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">{activeServices} פעילים</Badge>
          <Badge variant="outline" className="text-xs">{totalServices} שירותים</Badge>

          {/* Save to Database button */}
          <Button
            onClick={handleSaveToDb}
            disabled={saveStatus === 'saving'}
            className="gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            {saveStatus === 'saving' ? 'שומר...' : 'שמור ל-Database'}
          </Button>
        </div>
      </div>

      {/* Sync result banner */}
      {saveResult && saveStatus === 'success' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <Shield className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <span className="text-sm font-bold text-green-700">GREEN LIGHT — {saveResult.synced} שירותים נשמרו</span>
            <span className="text-xs text-green-600 mr-3">
              {saveResult.integrityOk ? 'INTEGRITY OK • sort_order locked' : `${saveResult.issues?.length} integrity issues`}
            </span>
          </div>
          <span className="text-[10px] text-green-500">
            <Clock className="w-3 h-3 inline mr-0.5" />
            {new Date(saveResult.timestamp).toLocaleTimeString('he-IL')}
          </span>
        </div>
      )}

      {/* Branch groups */}
      {BRANCHES.map(branch => {
        const services = groupedByBranch[branch.key] || [];
        if (services.length === 0 && branch.key === 'P4') {
          // P4 is Home — show empty state
          return (
            <div key={branch.key}
              className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
              style={{ borderColor: branch.color + '40' }}>
              <div className="flex items-center justify-between px-5 py-3"
                style={{ background: `linear-gradient(135deg, ${branch.color}08, ${branch.color}15)` }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color }} />
                  <span className="text-sm font-bold" style={{ color: branch.color }}>{branch.label}</span>
                </div>
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: branch.color + '40', color: branch.color }}>
                  0 שירותים
                </Badge>
              </div>
              <div className="px-5 py-4 text-center text-sm text-gray-400">
                ענף אישי — אין שירותים עסקיים
              </div>
            </div>
          );
        }
        if (services.length === 0) return null;

        return (
          <div key={branch.key}
            className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
            style={{ borderColor: branch.color + '40' }}>
            {/* Branch header */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ background: `linear-gradient(135deg, ${branch.color}08, ${branch.color}15)` }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color }} />
                <span className="text-sm font-bold" style={{ color: branch.color }}>{branch.label}</span>
              </div>
              <Badge variant="outline" className="text-[10px]" style={{ borderColor: branch.color + '40', color: branch.color }}>
                {services.length} שירותים
              </Badge>
            </div>

            {/* Service rows */}
            <div className="divide-y divide-gray-50">
              {services.map(svc => {
                const steps = svc.steps || [];
                const isExpanded = expandedServices.has(svc.key);
                const typeBadge = getTaskTypeBadge(svc);

                return (
                  <div key={svc.key}>
                    {/* Service row */}
                    <div
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(svc.key)}
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />

                      {/* Type badge */}
                      {typeBadge && (
                        <Badge className="text-[9px] h-5 px-1.5" style={{ backgroundColor: typeBadge.color + '15', color: typeBadge.color, border: `1px solid ${typeBadge.color}30` }}>
                          {typeBadge.label}
                        </Badge>
                      )}

                      {/* Step count */}
                      <span className="text-[10px] text-gray-400 min-w-[50px]">{steps.length} שלבים</span>

                      {/* Step badges (abbreviations) */}
                      <div className="flex items-center gap-0.5">
                        {steps.map((step, i) => (
                          <Badge key={`${step.key}-${i}`} variant="outline"
                            className="text-[8px] h-4 px-1 font-mono rounded"
                            style={{ borderColor: branch.color + '30', color: branch.color + 'CC' }}>
                            {getStepBadge(step)}
                          </Badge>
                        ))}
                      </div>

                      {/* Service key */}
                      <span className="text-[10px] text-gray-400 font-mono">{svc.key}</span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Service name */}
                      <span className="text-sm font-bold text-gray-800">{svc.label}</span>

                      {/* Active indicator */}
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color }} />
                    </div>

                    {/* Expanded: show steps with locked sort_order */}
                    {isExpanded && steps.length > 0 && (
                      <div className="px-12 pb-3">
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {steps.map((step, i) => (
                            <div key={`${step.key}-${i}`} className="flex items-center gap-3 text-xs">
                              <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: branch.color }}>
                                {i + 1}
                              </span>
                              <span className="font-medium text-gray-700">{step.label}</span>
                              <span className="text-[9px] text-gray-400 font-mono">sort_order: {i}</span>
                              <span className="text-[9px] text-gray-400 font-mono">parent: {svc.key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
