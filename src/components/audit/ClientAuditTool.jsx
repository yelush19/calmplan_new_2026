/**
 * ── ClientAuditTool: System-to-Customer Mapping Audit & Fix ──
 *
 * Three audit scans:
 *   1. Exempt Dealers with VAT tasks (entity logic violation)
 *   2. Payroll clients missing Deductions ID (missing metadata)
 *   3. Inline fix: update Customer Card fields directly
 *
 * Reads live Client + Task data, produces actionable tables,
 * and allows in-place fixes to Customer Cards.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Edit3, Save, Trash2 } from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { BUSINESS_TYPES } from '@/config/automationRules';

// ── Scan 1: Exempt Dealers who received VAT tasks ──
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

    // Also check if they have vat_reporting in their service_types
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

// ── Scan 2: Payroll clients missing Deductions ID ──
function scanMissingDeductionsId(clients, tasks) {
  const results = [];

  for (const client of clients) {
    const services = client.service_types || [];
    const hasPayroll = services.includes('payroll');
    const hasDeductions = services.includes('deductions');
    const isDirectTransmission = client.tax_info?.direct_transmission === true;

    // Client has payroll or deductions service
    if (!hasPayroll && !hasDeductions) continue;

    const deductionsId = client.tax_info?.annual_tax_ids?.deductions_id || '';
    const socialSecurityId = client.tax_info?.annual_tax_ids?.social_security_id || '';

    // Check if they have P1 tasks for March
    const p1Tasks = tasks.filter(t =>
      (t.client_name === client.name || t.client_id === client.id) &&
      (t.branch === 'P1' || t.category === 'שכר' || t.category === 'ניכויים' ||
       t.category === 'ביטוח לאומי' || t.serviceKey === 'payroll' ||
       t.serviceKey === 'deductions' || t.serviceKey === 'social_security')
    );

    const issues = [];
    if (!deductionsId && !isDirectTransmission) {
      issues.push({ field: 'deductions_id', label: 'תיק ניכויים', path: 'tax_info.annual_tax_ids.deductions_id' });
    }
    if (!socialSecurityId && !isDirectTransmission) {
      issues.push({ field: 'social_security_id', label: 'תיק ביטוח לאומי', path: 'tax_info.annual_tax_ids.social_security_id' });
    }

    if (issues.length > 0) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        businessType: BUSINESS_TYPES[client.business_info?.business_type] || client.business_info?.business_type || 'לא מוגדר',
        hasPayroll,
        hasDeductions,
        isDirectTransmission,
        p1TaskCount: p1Tasks.length,
        missingFields: issues,
        currentDeductionsId: deductionsId,
        currentSocialSecurityId: socialSecurityId,
      });
    }
  }
  return results;
}

// ── Fix Row: Inline editor for a single client ──
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
      {result.missingFields && (
        <>
          <td className="px-3 py-2 text-[10px]">
            {result.missingFields.map(f => (
              <span key={f.field} className="inline-flex items-center gap-1 mr-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold">
                <AlertTriangle className="w-3 h-3" /> {f.label}
              </span>
            ))}
          </td>
          <td className="px-3 py-2 text-[10px]" style={{ color: 'var(--cp-text-secondary)' }}>
            {result.p1TaskCount} משימות P1
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
                    <span className="text-[9px] font-bold w-20 text-right" style={{ color: 'var(--cp-text-secondary)' }}>
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

export default function ClientAuditTool({ clients = [], tasks = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('exempt_vat');
  const [actionLog, setActionLog] = useState([]);

  // ── Run Scans ──
  const exemptVatResults = useMemo(() => scanExemptDealersWithVAT(clients, tasks), [clients, tasks]);
  const missingIdResults = useMemo(() => scanMissingDeductionsId(clients, tasks), [clients, tasks]);

  // ── Fix: Remove vat_reporting from exempt dealer's services + delete VAT tasks ──
  const handleRemoveVatFromExempt = useCallback(async (result) => {
    try {
      const client = clients.find(c => c.id === result.clientId);
      if (!client) return;

      // Remove vat_reporting from service_types
      const updatedServices = (client.service_types || []).filter(s => s !== 'vat_reporting');
      await Client.update(result.clientId, { service_types: updatedServices });

      // Delete the VAT tasks
      for (const taskId of result.vatTaskIds) {
        try {
          await Task.delete(taskId);
        } catch (e) {
          console.error(`Failed to delete task ${taskId}:`, e);
        }
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

    const updatedAnnualIds = { ...currentAnnualIds };
    if (fieldValues.deductions_id) {
      updatedAnnualIds.deductions_id = fieldValues.deductions_id;
    }
    if (fieldValues.social_security_id) {
      updatedAnnualIds.social_security_id = fieldValues.social_security_id;
    }

    await Client.update(clientId, {
      tax_info: {
        ...currentTaxInfo,
        annual_tax_ids: updatedAnnualIds,
      },
    });

    setActionLog(prev => [...prev, {
      time: new Date().toLocaleTimeString('he-IL'),
      action: `עודכן כרטיס ${client.name}: ${Object.entries(fieldValues).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(', ')}`,
      type: 'success',
    }]);

    if (onRefresh) onRefresh();
  }, [clients, onRefresh]);

  const tabs = [
    { key: 'exempt_vat', label: 'עוסקים פטורים + מע"מ', count: exemptVatResults.length, color: '#EF4444' },
    { key: 'missing_ids', label: 'חסרים תיק ניכויים', count: missingIdResults.length, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--cp-text)' }}>
            ביקורת מיפוי מערכת-לקוח
          </h3>
          <p className="text-[10px]" style={{ color: 'var(--cp-text-secondary)' }}>
            סריקה חיה של {clients.length} לקוחות ו-{tasks.length} משימות
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                activeTab === t.key ? 'shadow-sm' : 'border-transparent hover:bg-gray-50'
              }`}
              style={{
                borderColor: activeTab === t.key ? t.color : 'transparent',
                background: activeTab === t.key ? t.color + '08' : undefined,
                color: activeTab === t.key ? t.color : 'var(--cp-text-secondary)',
              }}>
              {t.count > 0 && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ backgroundColor: t.color }}>
                  {t.count}
                </span>
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scan 1: Exempt Dealers with VAT ── */}
      {activeTab === 'exempt_vat' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="px-4 py-2.5 border-b" style={{
            borderColor: 'var(--cp-border)',
            background: exemptVatResults.length > 0 ? '#FEF2F210' : '#F0FDF410',
          }}>
            <div className="flex items-center gap-2">
              {exemptVatResults.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                {exemptVatResults.length > 0
                  ? `נמצאו ${exemptVatResults.length} עוסקים פטורים עם משימות/שירות מע"מ`
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

      {/* ── Scan 2: Missing Deductions/Social Security ID ── */}
      {activeTab === 'missing_ids' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="px-4 py-2.5 border-b" style={{
            borderColor: 'var(--cp-border)',
            background: missingIdResults.length > 0 ? '#FFFBEB10' : '#F0FDF410',
          }}>
            <div className="flex items-center gap-2">
              {missingIdResults.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-[11px] font-bold" style={{ color: 'var(--cp-text)' }}>
                {missingIdResults.length > 0
                  ? `נמצאו ${missingIdResults.length} לקוחות שכר ללא תיק ניכויים/ביט"ל`
                  : 'כל לקוחות השכר מכילים תיק ניכויים — תקין'}
              </span>
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--cp-text-secondary)' }}>
              לקוחות עם שירות שכר (P1) חייבים מספר תיק ניכויים וביטוח לאומי בכרטיס. עדכן כאן ישירות.
            </p>
          </div>

          {missingIdResults.length > 0 && (
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>לקוח</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>סוג עסק</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>שדות חסרים</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>משימות</th>
                  <th className="px-3 py-2 text-[9px] font-bold" style={{ color: 'var(--cp-text-secondary)' }}>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {missingIdResults.map(r => (
                  <FixRow key={r.clientId} result={r} onSave={handleUpdateClientIds} />
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
