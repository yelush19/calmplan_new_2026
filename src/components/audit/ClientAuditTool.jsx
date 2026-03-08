/**
 * ── System-Client Integrity Report ──
 *
 * Three audit scans based on SYSTEM DEFINITIONS vs CLIENT SELECTIONS:
 *
 *   Tab 1: Exempt Dealers with VAT (entity logic violation)
 *   Tab 2: Missing Metadata — CONDITIONAL on active services
 *          Only flags "Missing Deduction File" if payroll/deductions is checked.
 *   Tab 3: Process Integrity — Sub-process assigned WITHOUT parent service
 *          e.g. client has social_security but NOT payroll = config error.
 *
 * No "ghost" errors: if a client doesn't have a service, we don't flag
 * missing fields for that service.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Edit3, Save, Trash2,
  Shield, GitBranch, FileWarning,
} from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { BUSINESS_TYPES, SERVICE_LABELS } from '@/config/automationRules';

// ══════════════════════════════════════════════════════════════
// PARENT-CHILD SERVICE MAP (from automation rules)
// Key = child sub-process, Value = { parent, condition? }
// ══════════════════════════════════════════════════════════════
const SERVICE_DEPENDENCIES = [
  { child: 'social_security',    parent: 'payroll',          condition: null,       label: 'ביטוח לאומי ← שכר' },
  { child: 'deductions',         parent: 'payroll',          condition: null,       label: 'ניכויים ← שכר' },
  { child: 'annual_reports',     parent: 'bookkeeping',      altParent: 'bookkeeping_full', condition: null, label: 'דוחות שנתיים ← הנה"ח' },
  { child: 'reconciliation',     parent: 'bookkeeping',      altParent: 'bookkeeping_full', condition: { field: 'business_type', value: 'company' }, label: 'התאמות ← הנה"ח (חברה)' },
  { child: 'masav_employees',    parent: 'payroll',          condition: null,       label: 'מס"ב עובדים ← שכר' },
  { child: 'masav_social',       parent: 'payroll',          condition: null,       label: 'מס"ב סוציאליות ← שכר' },
  { child: 'masav_authorities',  parent: 'payroll',          condition: null,       label: 'מס"ב רשויות ← שכר' },
  { child: 'payslip_sending',    parent: 'payroll',          condition: null,       label: 'משלוח תלושים ← שכר' },
  { child: 'authorities_payment', parent: 'payroll',         condition: null,       label: 'תשלום רשויות ← שכר' },
];

// ══════════════════════════════════════════════════════════════
// SCAN 1: Exempt Dealers who received VAT (unchanged logic)
// ══════════════════════════════════════════════════════════════
function scanExemptDealersWithVAT(clients, tasks) {
  const exemptClients = clients.filter(c =>
    c.business_info?.business_type === 'exempt_dealer'
  );

  const results = [];
  for (const client of exemptClients) {
    const clientVatTasks = tasks.filter(t =>
      (t.client_name === client.name || t.client_id === client.id) &&
      (t.category === 'מע"מ' || t.category === 'מע"מ 874' ||
       t.serviceKey === 'vat_reporting' || t.serviceKey === 'vat')
    );
    const hasVatService = (client.service_types || []).includes('vat_reporting');

    if (clientVatTasks.length > 0 || hasVatService) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        businessType: 'עוסק פטור',
        hasVatService,
        vatTaskCount: clientVatTasks.length,
        vatTaskIds: clientVatTasks.map(t => t.id),
        vatTaskTitles: clientVatTasks.map(t => t.title),
        serviceTypes: client.service_types || [],
      });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// SCAN 2: CONDITIONAL — Missing metadata ONLY for active services
// ══════════════════════════════════════════════════════════════
function scanConditionalMissingFields(clients) {
  const results = [];

  for (const client of clients) {
    const services = client.service_types || [];
    const isDirectTransmission = client.tax_info?.direct_transmission === true;
    const issues = [];

    // ── STRICT: Only check deductions_id if PAYROLL is active ──
    // If client has orphan sub-services (deductions/social_security without payroll),
    // that's caught by the Process Integrity tab — not here.
    const hasPayroll = services.includes('payroll');
    if (hasPayroll && !isDirectTransmission) {
      const deductionsId = client.tax_info?.annual_tax_ids?.deductions_id ||
                           client.tax_info?.tax_deduction_file_number || '';
      if (!deductionsId) {
        issues.push({
          field: 'deductions_id',
          label: 'תיק ניכויים',
          path: 'tax_info.annual_tax_ids.deductions_id',
          requiredBy: 'שכר (payroll)',
        });
      }

      // ── Social security ID also gated on PAYROLL ──
      const socialSecurityId = client.tax_info?.annual_tax_ids?.social_security_id ||
                               client.tax_info?.social_security_file_number || '';
      if (!socialSecurityId) {
        issues.push({
          field: 'social_security_id',
          label: 'תיק ביטוח לאומי',
          path: 'tax_info.annual_tax_ids.social_security_id',
          requiredBy: 'שכר (payroll)',
        });
      }
    }

    // ── Only check tax_advances_id if tax_advances is ACTIVE ──
    if (services.includes('tax_advances')) {
      const taxAdvancesId = client.tax_info?.annual_tax_ids?.tax_advances_id || '';
      if (!taxAdvancesId) {
        issues.push({
          field: 'tax_advances_id',
          label: 'תיק מקדמות מס',
          path: 'tax_info.annual_tax_ids.tax_advances_id',
          requiredBy: 'tax_advances',
        });
      }
    }

    // ── Only check VAT file number if vat_reporting is ACTIVE ──
    if (services.includes('vat_reporting')) {
      const vatFile = client.tax_info?.vat_file_number || '';
      if (!vatFile) {
        issues.push({
          field: 'vat_file_number',
          label: 'מספר תיק מע"מ',
          path: 'tax_info.vat_file_number',
          requiredBy: 'vat_reporting',
        });
      }
    }

    if (issues.length > 0) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        businessType: BUSINESS_TYPES[client.business_info?.business_type] || client.business_info?.business_type || 'לא מוגדר',
        activeServices: services,
        isDirectTransmission,
        missingFields: issues,
      });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// SCAN 3: PROCESS INTEGRITY — Sub-process without parent
// ══════════════════════════════════════════════════════════════
function scanProcessIntegrity(clients) {
  const results = [];

  for (const client of clients) {
    const services = client.service_types || [];
    if (services.length === 0) continue;

    const businessType = client.business_info?.business_type || '';
    const violations = [];

    for (const dep of SERVICE_DEPENDENCIES) {
      // Does the client have the child sub-process?
      if (!services.includes(dep.child)) continue;

      // Check if condition applies (e.g. reconciliation only for companies)
      if (dep.condition) {
        if (dep.condition.field === 'business_type' && businessType !== dep.condition.value) {
          continue; // Condition doesn't apply — skip this check
        }
      }

      // Does the client have the parent?
      const hasParent = services.includes(dep.parent) ||
                        (dep.altParent && services.includes(dep.altParent));

      if (!hasParent) {
        violations.push({
          child: dep.child,
          childLabel: SERVICE_LABELS[dep.child] || dep.child,
          parent: dep.parent,
          parentLabel: SERVICE_LABELS[dep.parent] || dep.parent,
          altParent: dep.altParent,
          altParentLabel: dep.altParent ? (SERVICE_LABELS[dep.altParent] || dep.altParent) : null,
          ruleLabel: dep.label,
        });
      }
    }

    if (violations.length > 0) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        businessType: BUSINESS_TYPES[businessType] || businessType || 'לא מוגדר',
        activeServices: services,
        violations,
      });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// FIX ROW — Inline editor for missing metadata
// ══════════════════════════════════════════════════════════════
function FixRow({ result, onSave, onDeleteVatTasks }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleEdit = () => {
    const initial = {};
    if (result.missingFields) {
      result.missingFields.forEach(f => { initial[f.field] = ''; });
    }
    setValues(initial);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(result.clientId, values);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  };

  return (
    <tr className={`border-b transition-colors ${saved ? 'bg-green-50' : 'hover:bg-gray-50'}`}
      style={{ borderColor: 'var(--cp-border, #E2E8F0)' }}>
      <td className="px-3 py-2 text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
        {result.clientName}
      </td>
      <td className="px-3 py-2 text-[10px]" style={{ color: 'var(--cp-text-secondary)' }}>
        {result.businessType}
      </td>
      {/* VAT-specific columns */}
      {result.vatTaskCount !== undefined && (
        <>
          <td className="px-3 py-2 text-[10px] font-bold text-red-600">
            {result.vatTaskCount} משימות מע"מ
          </td>
          <td className="px-3 py-2 text-[10px]">
            {result.hasVatService && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[9px] font-bold">
                <XCircle className="w-3 h-3" /> vat_reporting בשירותים
              </span>
            )}
          </td>
          <td className="px-3 py-2">
            {result.vatTaskCount > 0 && onDeleteVatTasks && (
              <button onClick={() => onDeleteVatTasks(result)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                <Trash2 className="w-3 h-3" /> מחק משימות מע"מ
              </button>
            )}
          </td>
        </>
      )}
      {/* Missing fields columns */}
      {result.missingFields && !result.vatTaskCount && (
        <>
          <td className="px-3 py-2 text-[10px]">
            {result.missingFields.map(f => (
              <div key={f.field} className="flex items-center gap-1 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold">
                  <AlertTriangle className="w-3 h-3" /> {f.label}
                </span>
                <span className="text-[8px] text-gray-400">← {f.requiredBy}</span>
              </div>
            ))}
          </td>
          <td className="px-3 py-2">
            {saved ? (
              <span className="flex items-center gap-1 text-green-600 text-[10px] font-bold">
                <CheckCircle className="w-3.5 h-3.5" /> נשמר
              </span>
            ) : editing ? (
              <div className="flex flex-col gap-1.5">
                {result.missingFields.map(f => (
                  <div key={f.field} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold w-24 text-right" style={{ color: 'var(--cp-text-secondary)' }}>
                      {f.label}:
                    </span>
                    <input
                      type="text"
                      value={values[f.field] || ''}
                      onChange={(e) => setValues(prev => ({ ...prev, [f.field]: e.target.value }))}
                      className="w-28 px-2 py-1 rounded-lg border text-[10px]"
                      style={{ borderColor: 'var(--cp-border)', color: 'var(--cp-text)' }}
                      placeholder="הזן מספר תיק"
                      dir="ltr"
                    />
                  </div>
                ))}
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                  <Save className="w-3 h-3" /> {saving ? 'שומר...' : 'שמור'}
                </button>
              </div>
            ) : (
              <button onClick={handleEdit}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                <Edit3 className="w-3 h-3" /> עדכן כרטיס
              </button>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function ClientAuditTool({ clients = [], tasks = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('process_integrity');
  const [actionLog, setActionLog] = useState([]);

  // ── Run all scans ──
  const exemptVatResults = useMemo(() => scanExemptDealersWithVAT(clients, tasks), [clients, tasks]);
  const missingFieldResults = useMemo(() => scanConditionalMissingFields(clients), [clients]);
  const processResults = useMemo(() => scanProcessIntegrity(clients), [clients]);

  // Total issue count
  const totalIssues = exemptVatResults.length + missingFieldResults.length + processResults.length;

  // ── Fix: Remove VAT from exempt dealer ──
  const handleRemoveVatFromExempt = useCallback(async (result) => {
    try {
      const client = clients.find(c => c.id === result.clientId);
      if (!client) return;

      const updatedServices = (client.service_types || []).filter(s => s !== 'vat_reporting');
      await Client.update(result.clientId, { service_types: updatedServices });

      for (const taskId of result.vatTaskIds) {
        try { await Task.delete(taskId); } catch (e) { console.error(`Failed to delete task ${taskId}:`, e); }
      }

      setActionLog(prev => [...prev, {
        time: new Date().toLocaleTimeString('he-IL'),
        action: `הוסרו ${result.vatTaskCount} משימות מע"מ + שירות vat_reporting מ-${result.clientName}`,
        type: 'success',
      }]);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionLog(prev => [...prev, {
        time: new Date().toLocaleTimeString('he-IL'),
        action: `שגיאה בעדכון ${result.clientName}: ${err.message}`,
        type: 'error',
      }]);
    }
  }, [clients, onRefresh]);

  // ── Fix: Update missing IDs on client card ──
  const handleUpdateClientIds = useCallback(async (clientId, fieldValues) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    const currentTaxInfo = client.tax_info || {};
    const currentAnnualIds = currentTaxInfo.annual_tax_ids || {};
    const updatedTaxInfo = { ...currentTaxInfo };
    const updatedAnnualIds = { ...currentAnnualIds };

    // Route each field to the correct nested path
    for (const [field, value] of Object.entries(fieldValues)) {
      if (!value) continue;
      if (field === 'vat_file_number') {
        updatedTaxInfo.vat_file_number = value;
      } else {
        updatedAnnualIds[field] = value;
      }
    }
    updatedTaxInfo.annual_tax_ids = updatedAnnualIds;

    await Client.update(clientId, { tax_info: updatedTaxInfo });

    setActionLog(prev => [...prev, {
      time: new Date().toLocaleTimeString('he-IL'),
      action: `עודכן כרטיס ${client.name}: ${Object.entries(fieldValues).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(', ')}`,
      type: 'success',
    }]);
    if (onRefresh) onRefresh();
  }, [clients, onRefresh]);

  // ── Fix: Add missing parent service to client ──
  const handleAddParentService = useCallback(async (clientId, parentService) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const services = [...(client.service_types || [])];
    if (!services.includes(parentService)) {
      services.push(parentService);
    }
    await Client.update(clientId, { service_types: services });

    setActionLog(prev => [...prev, {
      time: new Date().toLocaleTimeString('he-IL'),
      action: `הוסף שירות "${SERVICE_LABELS[parentService] || parentService}" ל-${client.name}`,
      type: 'success',
    }]);
    if (onRefresh) onRefresh();
  }, [clients, onRefresh]);

  // ── Fix: Remove orphan child service from client ──
  const handleRemoveChildService = useCallback(async (clientId, childService) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const services = (client.service_types || []).filter(s => s !== childService);
    await Client.update(clientId, { service_types: services });

    setActionLog(prev => [...prev, {
      time: new Date().toLocaleTimeString('he-IL'),
      action: `הוסר שירות "${SERVICE_LABELS[childService] || childService}" מ-${client.name}`,
      type: 'success',
    }]);
    if (onRefresh) onRefresh();
  }, [clients, onRefresh]);

  const tabs = [
    { key: 'process_integrity', label: 'תקינות תהליכים', count: processResults.length, color: '#6366F1', icon: GitBranch },
    { key: 'missing_fields',    label: 'שדות חסרים (מותנה)', count: missingFieldResults.length, color: '#F59E0B', icon: FileWarning },
    { key: 'exempt_vat',        label: 'פטור + מע"מ', count: exemptVatResults.length, color: '#EF4444', icon: Shield },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header with Summary ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--cp-text)' }}>
            דוח תקינות מערכת-לקוח
          </h3>
          <p className="text-[10px]" style={{ color: 'var(--cp-text-secondary)' }}>
            {clients.length} לקוחות · {totalIssues === 0
              ? 'אין חריגות — המערכת תקינה'
              : `${totalIssues} חריגות נמצאו`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                  activeTab === t.key ? 'shadow-sm' : 'border-transparent hover:bg-gray-50'
                }`}
                style={{
                  borderColor: activeTab === t.key ? t.color : 'transparent',
                  background: activeTab === t.key ? t.color + '10' : undefined,
                  color: activeTab === t.key ? t.color : 'var(--cp-text-secondary)',
                }}>
                <Icon className="w-3.5 h-3.5" />
                {t.count > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                    style={{ backgroundColor: t.color }}>
                    {t.count}
                  </span>
                )}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PROCESS INTEGRITY — Sub-process without parent        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'process_integrity' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="px-4 py-2.5 border-b" style={{
            borderColor: 'var(--cp-border)',
            background: processResults.length > 0 ? '#EEF2FF' : '#F0FDF4',
          }}>
            <div className="flex items-center gap-2">
              {processResults.length > 0 ? (
                <GitBranch className="w-4 h-4 text-indigo-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                {processResults.length > 0
                  ? `${processResults.length} לקוחות עם תת-תהליך ללא שירות ראשי`
                  : 'כל התהליכים תקינים — אין תת-שירות ללא הורה'}
              </span>
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--cp-text-secondary)' }}>
              בודק: אם ללקוח מוגדר תת-תהליך (למשל ביטוח לאומי) אך לא השירות הראשי (שכר) — זו שגיאת הגדרה.
            </p>
          </div>

          {processResults.length > 0 && (
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>לקוח</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>סוג עסק</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>שגיאת הגדרה</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {processResults.map(r => (
                  <tr key={r.clientId} className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--cp-border, #E2E8F0)' }}>
                    <td className="px-3 py-2 text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                      {r.clientName}
                    </td>
                    <td className="px-3 py-2 text-[10px]" style={{ color: 'var(--cp-text-secondary)' }}>
                      {r.businessType}
                    </td>
                    <td className="px-3 py-2">
                      {r.violations.map((v, i) => (
                        <div key={i} className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-bold">
                            <XCircle className="w-3 h-3" /> {v.childLabel}
                          </span>
                          <span className="text-[9px] text-gray-400">ללא</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[9px] font-bold">
                            {v.parentLabel}
                            {v.altParentLabel && ` / ${v.altParentLabel}`}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {r.violations.map((v, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddParentService(r.clientId, v.parent)}
                              className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                              title={`הוסף ${v.parentLabel}`}>
                              + {v.parentLabel}
                            </button>
                            <button
                              onClick={() => handleRemoveChildService(r.clientId, v.child)}
                              className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                              title={`הסר ${v.childLabel}`}>
                              - {v.childLabel}
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: CONDITIONAL MISSING FIELDS                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'missing_fields' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="px-4 py-2.5 border-b" style={{
            borderColor: 'var(--cp-border)',
            background: missingFieldResults.length > 0 ? '#FFFBEB' : '#F0FDF4',
          }}>
            <div className="flex items-center gap-2">
              {missingFieldResults.length > 0 ? (
                <FileWarning className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                {missingFieldResults.length > 0
                  ? `${missingFieldResults.length} לקוחות חסרים שדות חובה עבור שירותים פעילים`
                  : 'כל השדות הנדרשים מולאו — תקין'}
              </span>
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--cp-text-secondary)' }}>
              בדיקה מותנית: שדה נדרש רק אם השירות התואם מסומן בכרטיס הלקוח. לא מציג שגיאות "רפאים" לשירותים שלא נבחרו.
            </p>
          </div>

          {missingFieldResults.length > 0 && (
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>לקוח</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>סוג עסק</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>שדות חסרים (← שירות דורש)</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {missingFieldResults.map(r => (
                  <FixRow key={r.clientId} result={r} onSave={handleUpdateClientIds} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 3: EXEMPT DEALERS WITH VAT                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'exempt_vat' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="px-4 py-2.5 border-b" style={{
            borderColor: 'var(--cp-border)',
            background: exemptVatResults.length > 0 ? '#FEF2F2' : '#F0FDF4',
          }}>
            <div className="flex items-center gap-2">
              {exemptVatResults.length > 0 ? (
                <Shield className="w-4 h-4 text-red-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                {exemptVatResults.length > 0
                  ? `${exemptVatResults.length} עוסקים פטורים עם משימות/שירות מע"מ`
                  : 'אין עוסקים פטורים עם משימות מע"מ — תקין'}
              </span>
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--cp-text-secondary)' }}>
              עוסק פטור אינו מחויב בדיווח מע"מ. משימות אלו הוזרקו בטעות ויש למחוק אותן.
            </p>
          </div>

          {exemptVatResults.length > 0 && (
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>לקוח</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>סוג עסק</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>משימות מע"מ</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>שירות</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {exemptVatResults.map(r => (
                  <FixRow key={r.clientId} result={r} onDeleteVatTasks={handleRemoveVatFromExempt} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Action Log ── */}
      {actionLog.length > 0 && (
        <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: 'var(--cp-border)' }}>
          <h4 className="text-[10px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>
            יומן פעולות
          </h4>
          {actionLog.map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="text-[9px] font-mono" style={{ color: 'var(--cp-text-secondary)' }}>{log.time}</span>
              {log.type === 'success' ? (
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500 shrink-0" />
              )}
              <span style={{ color: log.type === 'error' ? '#EF4444' : 'var(--cp-text)' }}>{log.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
