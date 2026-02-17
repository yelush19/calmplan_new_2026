import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Client, Task } from '@/api/entities';
import { TASK_BOARD_CATEGORIES } from '@/config/automationRules';
import {
  Trash2, Search, CheckCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, User, Tag, Calendar, XCircle
} from 'lucide-react';

// Precise 1:1 mapping: category → service key
const CATEGORY_TO_SERVICE = {};
for (const [boardKey, categories] of Object.entries(TASK_BOARD_CATEGORIES)) {
  for (const cat of categories) {
    if (cat.key && cat.service) {
      CATEGORY_TO_SERVICE[cat.key] = cat.service;
    }
  }
}

// Category → frequency field
const CATEGORY_TO_FREQ_FIELD = {
  'מע"מ': 'vat_reporting_frequency',
  'מקדמות מס': 'tax_advances_frequency',
  'שכר': 'payroll_frequency',
  'ביטוח לאומי': 'social_security_frequency',
  'ניכויים': 'deductions_frequency',
};

const SERVICE_LABELS = {
  bookkeeping: 'הנהלת חשבונות', vat_reporting: 'דיווחי מע״מ',
  tax_advances: 'מקדמות מס', payroll: 'שכר',
  social_security: 'ביטוח לאומי', deductions: 'מ״ה ניכויים',
  masav_employees: 'מס״ב עובדים', masav_social: 'מס״ב סוציאליות',
  masav_suppliers: 'מס״ב ספקים', authorities_payment: 'תשלום רשויות',
  operator_reporting: 'דיווח למתפעל', taml_reporting: 'דיווח לטמל',
  payslip_sending: 'משלוח תלושים', reserve_claims: 'תביעות מילואים',
};

const REASON_COLORS = {
  service_removed: 'bg-red-100 text-red-700 border-red-200',
  orphan_service: 'bg-orange-100 text-orange-700 border-orange-200',
  wrong_month: 'bg-amber-100 text-amber-700 border-amber-200',
  wrong_month_current: 'bg-blue-100 text-blue-700 border-blue-200',
  freq_na: 'bg-gray-100 text-gray-600 border-gray-200',
};

const REASON_LABELS = {
  service_removed: 'שירות הוסר מהכרטיס',
  orphan_service: 'שירות יתום (שכר הוסר)',
  wrong_month: 'חודש לא רלוונטי (דו-חודשי)',
  wrong_month_current: 'חודש שגוי (נוכחי במקום קודם)',
  freq_na: 'תדירות לא רלוונטית',
};

export default function CleanupTool({ rules = [] }) {
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState(null); // { byClient: {clientName: [...items]}, total: N }
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Build auto-link map from rules
  const autoLinkParents = {};
  for (const rule of rules) {
    if (rule.type !== 'service_auto_link' || !rule.enabled) continue;
    for (const child of (rule.auto_add_services || [])) {
      autoLinkParents[child] = rule.trigger_service;
    }
  }

  const handleScan = async () => {
    setScanning(true);
    setFindings(null);
    setResult(null);
    setSelectedItems(new Set());

    try {
      const [allClients, allTasks] = await Promise.all([
        Client.list(null, 5000),
        Task.list(null, 10000),
      ]);

      const clientsArr = Array.isArray(allClients) ? allClients : [];
      const tasksArr = Array.isArray(allTasks) ? allTasks : [];

      // Build client lookup by name and id
      const clientByName = {};
      const clientById = {};
      for (const c of clientsArr) {
        if (c.name) clientByName[c.name] = c;
        if (c.id) clientById[c.id] = c;
      }

      const byClient = {};
      let total = 0;

      for (const task of tasksArr) {
        // Skip already completed or not_relevant
        if (task.status === 'completed' || task.status === 'not_relevant') continue;
        if (!task.category) continue;

        // Find matching client
        const client = (task.client_id && clientById[task.client_id])
          || (task.client_name && clientByName[task.client_name]);
        if (!client) continue;

        const clientServices = client.service_types || [];
        const reportingInfo = client.reporting_info || {};
        let reason = null;
        let detail = '';

        // Check 1: Service for this category exists on client
        const requiredService = CATEGORY_TO_SERVICE[task.category];
        if (requiredService) {
          if (!clientServices.includes(requiredService)) {
            reason = 'service_removed';
            detail = `קטגוריה "${task.category}" דורשת שירות "${SERVICE_LABELS[requiredService] || requiredService}" - לא קיים בכרטיס`;
          } else {
            // Check 1b: Auto-link orphan check
            const parent = autoLinkParents[requiredService];
            if (parent && !clientServices.includes(parent)) {
              reason = 'orphan_service';
              detail = `שירות "${SERVICE_LABELS[requiredService] || requiredService}" קיים אבל שירות האב "${SERVICE_LABELS[parent] || parent}" הוסר`;
            }
          }
        }

        // Check 2: Frequency mismatch (bi-monthly / not_applicable)
        if (!reason && task.due_date) {
          const freqField = CATEGORY_TO_FREQ_FIELD[task.category];
          const freq = freqField ? reportingInfo[freqField] : null;

          if (freq === 'not_applicable') {
            reason = 'freq_na';
            detail = `תדירות "${task.category}" מוגדרת כ"לא רלוונטי" בכרטיס`;
          } else if (freq === 'bimonthly') {
            try {
              const dueDate = new Date(task.due_date);
              const taskMonth = dueDate.getMonth(); // 0-based
              if (taskMonth % 2 !== 0) {
                const monthName = dueDate.toLocaleDateString('he-IL', { month: 'long' });
                reason = 'wrong_month';
                detail = `לקוח דו-חודשי, משימה בחודש ${monthName} (אי-זוגי)`;
              }
            } catch { /* skip */ }
          }
        }

        // Check 3: Task in current month instead of previous month
        // The system always works on the PREVIOUS month, so tasks with due_date
        // in the current month were likely created with the wrong month
        if (!reason && task.due_date) {
          try {
            const dueDate = new Date(task.due_date);
            const taskMonth = dueDate.getMonth();
            const taskYear = dueDate.getFullYear();
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            if (taskMonth === currentMonth && taskYear === currentYear) {
              reason = 'wrong_month_current';
              const currentMonthName = now.toLocaleDateString('he-IL', { month: 'long' });
              const prevDate = new Date(currentYear, currentMonth - 1, 1);
              const prevMonthName = prevDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
              detail = `משימה עם תאריך יעד בחודש הנוכחי (${currentMonthName}) - צריכה להיות בחודש הקודם (${prevMonthName})`;
            }
          } catch { /* skip */ }
        }

        if (reason) {
          const key = client.name || task.client_name || 'לא ידוע';
          if (!byClient[key]) byClient[key] = { client, items: [] };
          const itemId = `${task.id}`;
          byClient[key].items.push({
            id: itemId,
            task,
            reason,
            detail,
            requiredService,
          });
          total++;
        }
      }

      // Auto-select all
      const allIds = new Set();
      for (const group of Object.values(byClient)) {
        for (const item of group.items) allIds.add(item.id);
      }
      setSelectedItems(allIds);

      // Auto-expand all clients
      setExpandedClients(new Set(Object.keys(byClient)));

      setFindings({ byClient, total });
    } catch (err) {
      console.error('Scan error:', err);
      setFindings({ error: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleExecute = async () => {
    if (!findings || !findings.byClient) return;
    const toClean = [];
    for (const group of Object.values(findings.byClient)) {
      for (const item of group.items) {
        if (selectedItems.has(item.id)) toClean.push(item);
      }
    }
    if (toClean.length === 0) return;

    const wrongMonthCount = toClean.filter(i => i.reason === 'wrong_month_current').length;
    const notRelevantCount = toClean.length - wrongMonthCount;
    const confirmMsg = wrongMonthCount > 0 && notRelevantCount > 0
      ? `לתקן ${wrongMonthCount} משימות חודש שגוי ולסמן ${notRelevantCount} כ"לא רלוונטי"?`
      : wrongMonthCount > 0
      ? `לתקן ${wrongMonthCount} משימות חודש שגוי (להזיז לחודש הקודם)?`
      : `לסמן ${toClean.length} משימות כ"לא רלוונטי"?`;
    if (!window.confirm(confirmMsg)) return;

    setExecuting(true);
    let success = 0;
    let errors = 0;
    for (const item of toClean) {
      try {
        if (item.reason === 'wrong_month_current') {
          // Fix the due_date and title to previous month
          const dueDate = new Date(item.task.due_date);
          const prevMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, 1);
          const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
          const fixedDay = Math.min(dueDate.getDate(), prevMonthEnd.getDate());
          const fixedDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), fixedDay);
          const fixedDateStr = fixedDate.toISOString().split('T')[0];

          // Try to fix month name in title (with and without year)
          const currentMonthLabelFull = dueDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
          const prevMonthLabelFull = fixedDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
          const currentMonthName = dueDate.toLocaleDateString('he-IL', { month: 'long' });
          const prevMonthName = fixedDate.toLocaleDateString('he-IL', { month: 'long' });
          let fixedTitle = item.task.title || '';
          // Replace "פברואר 2026" → "ינואר 2026" first (more specific)
          if (fixedTitle.includes(currentMonthLabelFull)) {
            fixedTitle = fixedTitle.replace(currentMonthLabelFull, prevMonthLabelFull);
          } else if (fixedTitle.includes(currentMonthName)) {
            // Replace just "פברואר" → "ינואר"
            fixedTitle = fixedTitle.replace(currentMonthName, prevMonthName);
          }
          // If title didn't change, that's OK - we still fix the due_date

          await Task.update(item.task.id, { due_date: fixedDateStr, title: fixedTitle });
        } else {
          await Task.update(item.task.id, { status: 'not_relevant' });
        }
        success++;
      } catch {
        errors++;
      }
    }
    setResult({ success, errors });
    setExecuting(false);
    // Re-scan
    if (success > 0) {
      setTimeout(() => handleScan(), 500);
    }
  };

  const toggleClient = (name) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleClientAll = (clientName, items) => {
    const allSelected = items.every(i => selectedItems.has(i.id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      for (const item of items) {
        if (allSelected) next.delete(item.id); else next.add(item.id);
      }
      return next;
    });
  };

  const selectedCount = selectedItems.size;

  // Summary stats
  const stats = findings?.byClient ? Object.values(findings.byClient).reduce((acc, group) => {
    for (const item of group.items) {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
    }
    return acc;
  }, {}) : {};

  return (
    <Card className="border-2 border-teal-300 bg-teal-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Trash2 className="w-5 h-5 text-teal-600" />
            כלי ניקוי משימות
          </div>
          <Button
            onClick={handleScan}
            disabled={scanning}
            size="sm"
            className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'סורק...' : 'סרוק אי-התאמות'}
          </Button>
        </CardTitle>
        <p className="text-xs text-gray-500">
          סורק את כל המשימות ומוצא אי-התאמות מול הגדרות כרטיס הלקוח (שירותים, תדירויות)
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Result message */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.errors > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <CheckCircle className="w-4 h-4 inline ml-1 text-green-600" />
            עודכנו {result.success} משימות בהצלחה
            {result.errors > 0 && <span className="text-red-600"> ({result.errors} שגיאות)</span>}
          </div>
        )}

        {/* Findings */}
        {findings && !findings.error && (
          <>
            {findings.total === 0 ? (
              <div className="p-6 text-center bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-medium text-lg">הכל תקין!</p>
                <p className="text-green-600 text-sm">כל המשימות תואמות את הגדרות כרטיסי הלקוחות</p>
              </div>
            ) : (
              <>
                {/* Stats summary */}
                <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border">
                  <span className="text-sm font-bold text-gray-700">
                    נמצאו {findings.total} אי-התאמות ב-{Object.keys(findings.byClient).length} לקוחות:
                  </span>
                  {Object.entries(stats).map(([reason, count]) => (
                    <Badge key={reason} className={`text-xs border ${REASON_COLORS[reason]}`}>
                      {REASON_LABELS[reason]}: {count}
                    </Badge>
                  ))}
                </div>

                {/* Client groups */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {Object.entries(findings.byClient)
                    .sort(([, a], [, b]) => b.items.length - a.items.length)
                    .map(([clientName, group]) => {
                      const isExpanded = expandedClients.has(clientName);
                      const allSelected = group.items.every(i => selectedItems.has(i.id));
                      const someSelected = group.items.some(i => selectedItems.has(i.id));
                      const clientServices = (group.client?.service_types || []).map(s => SERVICE_LABELS[s] || s);

                      return (
                        <div key={clientName} className="border rounded-lg bg-white overflow-hidden">
                          {/* Client header */}
                          <div
                            className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => toggleClient(clientName)}
                          >
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleClientAll(clientName, group.items)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                            />
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-gray-400" />
                              : <ChevronRight className="w-4 h-4 text-gray-400" />
                            }
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-bold text-gray-800 text-sm">{clientName}</span>
                            <Badge className="bg-red-100 text-red-700 text-[10px] border border-red-200">
                              {group.items.length} אי-התאמות
                            </Badge>
                            <div className="flex-1" />
                            <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                              שירותים: {clientServices.length > 0 ? clientServices.join(', ') : 'ללא'}
                            </span>
                          </div>

                          {/* Items */}
                          {isExpanded && (
                            <div className="divide-y divide-gray-50">
                              {group.items.map(item => {
                                const isSelected = selectedItems.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-2 px-4 py-2 text-xs transition-colors ${isSelected ? 'bg-teal-50/50' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleItem(item.id)}
                                      className="w-3.5 h-3.5 mt-0.5 rounded border-gray-300 text-teal-600 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-gray-700 truncate max-w-[250px]">
                                          {item.task.title}
                                        </span>
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                          {item.task.category}
                                        </Badge>
                                        {item.task.due_date && (
                                          <span className="text-gray-400 flex items-center gap-0.5">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(item.task.due_date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })}
                                          </span>
                                        )}
                                        <Badge className={`text-[9px] px-1.5 py-0 border ${REASON_COLORS[item.reason]}`}>
                                          {REASON_LABELS[item.reason]}
                                        </Badge>
                                      </div>
                                      <p className="text-gray-500 mt-0.5">{item.detail}</p>
                                    </div>
                                    <span className="text-[10px] text-gray-300 whitespace-nowrap">
                                      סטטוס: {item.task.status}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Execute button */}
                {(() => {
                  const selectedArr = [...selectedItems];
                  const allItems = Object.values(findings.byClient).flatMap(g => g.items);
                  const selectedItemsArr = allItems.filter(i => selectedArr.includes(i.id));
                  const fixMonthCount = selectedItemsArr.filter(i => i.reason === 'wrong_month_current').length;
                  const markNrCount = selectedCount - fixMonthCount;
                  const label = fixMonthCount > 0 && markNrCount > 0
                    ? `תקן ${fixMonthCount} חודש + סמן ${markNrCount} לא-רלוונטי`
                    : fixMonthCount > 0
                    ? `תקן ${fixMonthCount} משימות חודש שגוי`
                    : `סמן ${selectedCount} כ"לא רלוונטי"`;
                  return (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-teal-200">
                      <div className="text-sm text-gray-600">
                        נבחרו <strong className="text-teal-700">{selectedCount}</strong> מתוך {findings.total} משימות
                        {fixMonthCount > 0 && <span className="text-blue-600 text-xs mr-2">({fixMonthCount} תיקון חודש)</span>}
                      </div>
                      <Button
                        onClick={handleExecute}
                        disabled={executing || selectedCount === 0}
                        className={`gap-1 text-white ${fixMonthCount > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                        size="sm"
                      >
                        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {executing ? 'מבצע...' : label}
                      </Button>
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}

        {findings?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 inline ml-1" />
            שגיאה: {findings.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
