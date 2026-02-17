import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, Settings, Play, Loader2, X, CheckSquare, Square, CalendarDays } from 'lucide-react';
import {
  loadAutomationRules, saveAutomationRules,
  ALL_SERVICES, BUSINESS_TYPES, REPORT_ENTITIES,
  PERIODIC_REPORT_TYPES, PERIODIC_REPORT_PERIODS,
  TASK_BOARD_CATEGORIES, RECONCILIATION_TYPES,
  DEFAULT_RULES, getReportAutoCreateRules,
} from '@/config/automationRules';
import { Client, PeriodicReport, BalanceSheet, Task, AccountReconciliation, ClientAccount } from '@/api/entities';

// Icons/colors per target entity for display
const entityDisplayConfig = {
  PeriodicReport: { color: 'bg-purple-100 text-purple-800', label: 'דיווחים מרכזים' },
  BalanceSheet: { color: 'bg-amber-100 text-amber-800', label: 'מאזנים' },
  AccountReconciliation: { color: 'bg-cyan-100 text-cyan-800', label: 'התאמות' },
  Task_monthly_reports: { color: 'bg-slate-100 text-slate-800', label: 'ריכוז חודשי' },
  Task_tax_reports: { color: 'bg-orange-100 text-orange-800', label: 'דיווחי מיסים' },
  Task_payroll: { color: 'bg-pink-100 text-pink-800', label: 'שכר' },
  Task_additional_services: { color: 'bg-indigo-100 text-indigo-800', label: 'שירותים נוספים' },
};

function getEmptyRule(type) {
  if (type === 'service_auto_link') {
    return {
      id: `rule_${Date.now()}`,
      name: '',
      description: '',
      type: 'service_auto_link',
      enabled: true,
      trigger_service: '',
      auto_add_services: [],
      condition: null,
    };
  }
  return {
    id: `rule_${Date.now()}`,
    name: '',
    description: '',
    type: 'report_auto_create',
    enabled: true,
    trigger_services: [],
    target_entity: 'PeriodicReport',
    report_types: {},
    task_categories: [],
    condition: null,
    due_day_of_month: null,
  };
}

function RuleEditor({ rule, onSave, onCancel }) {
  const [editRule, setEditRule] = useState({ ...rule });
  const isServiceLink = editRule.type === 'service_auto_link';

  const handleChange = (field, value) => {
    setEditRule(prev => ({ ...prev, [field]: value }));
  };

  const handleConditionToggle = (enabled) => {
    if (enabled) {
      setEditRule(prev => ({ ...prev, condition: { field: 'business_type', value: 'company' } }));
    } else {
      setEditRule(prev => ({ ...prev, condition: null }));
    }
  };

  const isTaskBoard = editRule.target_entity?.startsWith('Task_');
  const taskCategories = isTaskBoard ? (TASK_BOARD_CATEGORIES[editRule.target_entity] || []) : [];

  const isValid = editRule.name.trim() &&
    (isServiceLink
      ? editRule.trigger_service && editRule.auto_add_services.length > 0
      : (editRule.trigger_services || []).length > 0);

  return (
    <DialogContent className="bg-white max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{rule.name ? 'עריכת חוק' : 'חוק חדש'}</DialogTitle>
        <DialogDescription>
          {isServiceLink ? 'כשנבחר שירות ללקוח, סמן אוטומטית שירותים נוספים' : 'כששומרים לקוח עם שירותים מסוימים, צור רשומות אוטומטית בלוח הנבחר'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div>
          <Label>שם החוק</Label>
          <Input value={editRule.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="למשל: שכר → ביטוח לאומי" />
        </div>
        <div>
          <Label>תיאור</Label>
          <Input value={editRule.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="הסבר קצר מה החוק עושה" />
        </div>

        {isServiceLink ? (
          <>
            <div>
              <Label>כשנבחר השירות:</Label>
              <Select value={editRule.trigger_service} onValueChange={(v) => handleChange('trigger_service', v)}>
                <SelectTrigger><SelectValue placeholder="בחר שירות מפעיל" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {Object.entries(ALL_SERVICES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סמן אוטומטית גם:</Label>
              <ToggleGroup type="multiple" value={editRule.auto_add_services || []} onValueChange={(v) => handleChange('auto_add_services', v)} className="flex-wrap justify-start">
                {Object.entries(ALL_SERVICES).filter(([k]) => k !== editRule.trigger_service).map(([k, v]) => (
                  <ToggleGroupItem key={k} value={k} className="text-xs">{v}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={!!editRule.condition} onCheckedChange={handleConditionToggle} />
              <Label>רק אם סוג עסק מסוים</Label>
            </div>
            {editRule.condition && (
              <Select value={editRule.condition.value} onValueChange={(v) => setEditRule(prev => ({ ...prev, condition: { ...prev.condition, value: v } }))}>
                <SelectTrigger><SelectValue placeholder="בחר סוג עסק" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        ) : (
          <>
            <div>
              <Label>כשללקוח יש אחד מהשירותים:</Label>
              <ToggleGroup type="multiple" value={editRule.trigger_services || []} onValueChange={(v) => handleChange('trigger_services', v)} className="flex-wrap justify-start">
                {Object.entries(ALL_SERVICES).map(([k, v]) => (
                  <ToggleGroupItem key={k} value={k} className="text-xs">{v}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div>
              <Label>לוח יעד</Label>
              <Select value={editRule.target_entity} onValueChange={(v) => {
                handleChange('target_entity', v);
                // Reset entity-specific fields when changing target
                setEditRule(prev => ({ ...prev, target_entity: v, report_types: {}, task_categories: [] }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {Object.entries(REPORT_ENTITIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PeriodicReport config */}
            {editRule.target_entity === 'PeriodicReport' && (
              <div>
                <Label>סוגי דיווח ותקופות</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(PERIODIC_REPORT_TYPES).map(([typeKey, typeLabel]) => (
                    <div key={typeKey} className="border rounded p-3">
                      <div className="font-medium text-sm mb-2">{typeLabel}</div>
                      <ToggleGroup
                        type="multiple"
                        value={(editRule.report_types || {})[typeKey] || []}
                        onValueChange={(periods) => {
                          setEditRule(prev => {
                            const rt = { ...(prev.report_types || {}) };
                            if (periods.length > 0) {
                              rt[typeKey] = periods;
                            } else {
                              delete rt[typeKey];
                            }
                            return { ...prev, report_types: rt };
                          });
                        }}
                        className="justify-start"
                      >
                        {Object.entries(PERIODIC_REPORT_PERIODS).map(([pk, pv]) => (
                          <ToggleGroupItem key={pk} value={pk} className="text-xs">{pv}</ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task board config - select categories */}
            {isTaskBoard && taskCategories.length > 0 && (
              <div>
                <Label>קטגוריות משימה ליצירה</Label>
                <ToggleGroup
                  type="multiple"
                  value={editRule.task_categories || []}
                  onValueChange={(v) => handleChange('task_categories', v)}
                  className="flex-wrap justify-start mt-2"
                >
                  {taskCategories.map(cat => (
                    <ToggleGroupItem key={cat.key} value={cat.key} className="text-xs">{cat.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}

            {/* Due date (day of month) for Task-based boards */}
            {isTaskBoard && (
              <div>
                <Label>תאריך יעד (יום בחודש)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={editRule.due_day_of_month || ''}
                    onChange={(e) => handleChange('due_day_of_month', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="לדוגמה: 19"
                    className="w-24 text-sm"
                  />
                  <span className="text-xs text-gray-500">לחודש (ברירת מחדל: יום אחרון בחודש)</span>
                </div>
              </div>
            )}

            {/* AccountReconciliation info */}
            {editRule.target_entity === 'AccountReconciliation' && (
              <div className="border rounded p-3 bg-cyan-50 text-sm text-cyan-800">
                ייצור שורות התאמה לכל חשבונות הלקוח (בנקים/אשראי) עבור החודש הנוכחי
              </div>
            )}

            {/* BalanceSheet info */}
            {editRule.target_entity === 'BalanceSheet' && (
              <div className="border rounded p-3 bg-amber-50 text-sm text-amber-800">
                ייצור שורת מאזן שנתי ללקוח עבור שנת המס הקודמת
              </div>
            )}

            {/* Condition (business type) */}
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={!!editRule.condition} onCheckedChange={handleConditionToggle} />
              <Label>רק אם סוג עסק מסוים</Label>
            </div>
            {editRule.condition && (
              <Select value={editRule.condition.value} onValueChange={(v) => setEditRule(prev => ({ ...prev, condition: { ...prev.condition, value: v } }))}>
                <SelectTrigger><SelectValue placeholder="בחר סוג עסק" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>ביטול</Button>
        <Button onClick={() => onSave(editRule)} disabled={!isValid}>שמור חוק</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RuleRow({ rule, onToggle, onEdit, onDelete, onRun, isRunning }) {
  const entityCfg = entityDisplayConfig[rule.target_entity] || {};
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${rule.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
      <div className="flex items-center gap-3 flex-1">
        <Switch checked={rule.enabled} onCheckedChange={() => onToggle(rule.id)} />
        <div>
          <div className="font-medium text-sm">{rule.name}</div>
          <div className="text-xs text-gray-500">{rule.description}</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {rule.type === 'service_auto_link' && rule.condition && (
              <Badge variant="outline" className="text-xs">
                תנאי: {BUSINESS_TYPES[rule.condition.value] || rule.condition.value}
              </Badge>
            )}
            {rule.type === 'report_auto_create' && (
              <>
                <Badge className={`text-xs ${entityCfg.color || 'bg-gray-100 text-gray-800'}`}>
                  {REPORT_ENTITIES[rule.target_entity] || rule.target_entity}
                </Badge>
                {rule.condition && (
                  <Badge variant="outline" className="text-xs">
                    תנאי: {BUSINESS_TYPES[rule.condition.value] || rule.condition.value}
                  </Badge>
                )}
                {rule.report_types && Object.keys(rule.report_types).map(tk => (
                  <Badge key={tk} variant="secondary" className="text-xs">
                    {PERIODIC_REPORT_TYPES[tk] || tk}: {(rule.report_types[tk] || []).map(p => PERIODIC_REPORT_PERIODS[p] || p).join(', ')}
                  </Badge>
                ))}
                {rule.task_categories?.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {rule.task_categories.join(', ')}
                  </Badge>
                )}
                {rule.due_day_of_month && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                    יעד: {rule.due_day_of_month} לחודש
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRun && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRun(rule.id); }}
            disabled={isRunning || !rule.enabled}
            className="gap-1 text-yellow-700 border-yellow-400 hover:bg-yellow-50 hover:text-yellow-800 h-8 px-3"
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span className="text-xs">{isRunning ? 'סורק...' : 'הפעל'}</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onEdit(rule)}><Pencil className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

export default function AutomationRules() {
  const [rules, setRules] = useState([]);
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [newRuleType, setNewRuleType] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [bulkScanning, setBulkScanning] = useState(false);
  const [bulkExecuting, setBulkExecuting] = useState(false);
  const [bulkPreview, setBulkPreview] = useState(null); // { items: [...], stats }
  const [bulkResult, setBulkResult] = useState(null);
  const [showRulePicker, setShowRulePicker] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [runningRuleId, setRunningRuleId] = useState(null);
  const [startMonth, setStartMonth] = useState(new Date().getMonth()); // 0-based (0=Jan)
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [cleanupScanning, setCleanupScanning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    const { rules: loadedRules, configId: id } = await loadAutomationRules();
    setRules(loadedRules);
    setConfigId(id);
    setIsLoading(false);
  };

  const handleSave = async (updatedRules) => {
    try {
      const newId = await saveAutomationRules(configId, updatedRules);
      if (newId) setConfigId(newId);
      setRules(updatedRules);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleToggleRule = async (ruleId) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
    await handleSave(updated);
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('למחוק את החוק?')) return;
    const updated = rules.filter(r => r.id !== ruleId);
    await handleSave(updated);
  };

  const handleSaveRule = async (rule) => {
    const existing = rules.findIndex(r => r.id === rule.id);
    let updated;
    if (existing >= 0) {
      updated = [...rules];
      updated[existing] = rule;
    } else {
      updated = [...rules, rule];
    }
    await handleSave(updated);
    setEditingRule(null);
    setNewRuleType(null);
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('לאפס את כל החוקים לברירת המחדל? חוקים מותאמים אישית יימחקו.')) return;
    await handleSave([...DEFAULT_RULES]);
  };

  // Bulk cleanup: scan all clients and mark tasks for removed services as not_relevant
  // Also cleans up bi-monthly clients: tasks in odd months are not relevant
  const handleBulkCleanup = async () => {
    if (!window.confirm('לסרוק את כל הלקוחות ולנקות משימות של שירותים שהוסרו ותדירויות שגויות?')) return;
    setCleanupScanning(true);
    setCleanupResult(null);
    try {
      const [allClients, allTasks] = await Promise.all([
        Client.list(null, 5000),
        Task.list(null, 10000),
      ]);

      // Build PRECISE category → service mapping from TASK_BOARD_CATEGORIES (1:1)
      const categoryToService = {};
      for (const [boardKey, categories] of Object.entries(TASK_BOARD_CATEGORIES)) {
        for (const cat of categories) {
          if (cat.key && cat.service) {
            categoryToService[cat.key] = cat.service;
          }
        }
      }

      // Build auto-link dependencies: if parent removed → children are "orphan"
      const autoLinkParents = {}; // child_service → parent_service
      for (const rule of rules) {
        if (rule.type !== 'service_auto_link' || !rule.enabled) continue;
        for (const child of (rule.auto_add_services || [])) {
          autoLinkParents[child] = rule.trigger_service;
        }
      }

      // Category → frequency field mapping for bi-monthly check
      const categoryFreqField = {
        'מע"מ': 'vat_reporting_frequency',
        'מקדמות מס': 'tax_advances_frequency',
        'שכר': 'payroll_frequency',
        'ביטוח לאומי': 'social_security_frequency',
        'ניכויים': 'deductions_frequency',
      };

      let cleanedCount = 0;
      const details = [];
      const clientsArr = Array.isArray(allClients) ? allClients : [];
      const tasksArr = Array.isArray(allTasks) ? allTasks : [];

      for (const client of clientsArr) {
        const clientServices = client.service_types || [];
        const reportingInfo = client.reporting_info || {};
        const clientTasks = tasksArr.filter(t =>
          (t.client_name === client.name || t.client_id === client.id) &&
          t.status !== 'completed' &&
          t.status !== 'not_relevant'
        );

        if (clientTasks.length === 0) continue;

        // Check which services are truly active (including auto-link parent check)
        const effectiveServices = new Set(clientServices);
        // If a service's parent (from auto-link) is missing, consider it orphaned
        for (const svc of clientServices) {
          const parent = autoLinkParents[svc];
          if (parent && !clientServices.includes(parent)) {
            effectiveServices.delete(svc);
          }
        }

        for (const task of clientTasks) {
          if (!task.category) continue;
          let reason = null;

          // Check 1: Service removed from client
          const requiredService = categoryToService[task.category];
          if (requiredService && !effectiveServices.has(requiredService)) {
            reason = 'שירות הוסר';
          }

          // Check 2: Bi-monthly frequency - task in wrong month
          if (!reason && task.due_date) {
            const freqField = categoryFreqField[task.category];
            const freq = freqField ? reportingInfo[freqField] : null;
            if (freq === 'bimonthly') {
              try {
                const dueDate = new Date(task.due_date);
                const taskMonth = dueDate.getMonth(); // 0-based
                if (taskMonth % 2 !== 0) {
                  reason = 'דו-חודשי - חודש לא רלוונטי';
                }
              } catch { /* skip */ }
            }
            if (freq === 'not_applicable') {
              reason = 'תדירות לא רלוונטית';
            }
          }

          if (reason) {
            await Task.update(task.id, { status: 'not_relevant' });
            cleanedCount++;
            details.push({
              clientName: client.name,
              taskTitle: task.title,
              category: task.category,
              reason,
            });
          }
        }
      }

      setCleanupResult({ cleaned: cleanedCount, details });
    } catch (err) {
      console.error('Cleanup error:', err);
      setCleanupResult({ error: err.message });
    } finally {
      setCleanupScanning(false);
    }
  };

  // Open rule picker before scanning
  const handleOpenRulePicker = () => {
    const enabledReportRules = rules.filter(r => r.type === 'report_auto_create' && r.enabled);
    setSelectedRuleIds(enabledReportRules.map(r => r.id));
    setShowRulePicker(true);
    setBulkResult(null);
  };

  const handleToggleRuleSelection = (ruleId) => {
    setSelectedRuleIds(prev =>
      prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]
    );
  };

  // Run a single rule directly (per-rule Play button)
  const handleRunSingleRule = (ruleId) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    if (rule.type === 'service_auto_link') {
      handleRunServiceLinkRule(rule);
    } else {
      setRunningRuleId(ruleId);
      setSelectedRuleIds([ruleId]);
      handleBulkScan([ruleId]);
    }
  };

  // Run a service_auto_link rule on all active clients
  const handleRunServiceLinkRule = async (rule) => {
    setRunningRuleId(rule.id);
    setBulkResult(null);

    try {
      const allClients = await Client.list(null, 5000);
      const activeClients = allClients.filter(c => c.status === 'active');
      const resultDetails = [];

      const businessType = rule.condition?.field === 'business_type' ? rule.condition.value : null;

      for (const client of activeClients) {
        const services = client.service_types || [];
        if (!services.includes(rule.trigger_service)) continue;

        // Check business type condition
        if (businessType) {
          const clientBizType = client.business_info?.business_type || client.business_type || '';
          if (clientBizType !== businessType) continue;
        }

        const servicesToAdd = (rule.auto_add_services || []).filter(s => !services.includes(s));
        if (servicesToAdd.length === 0) continue;

        try {
          const updatedServices = [...services, ...servicesToAdd];
          await Client.update(client.id, { service_types: updatedServices });
          resultDetails.push({
            clientName: client.name,
            entityLabel: 'שירותים',
            description: `נוספו: ${servicesToAdd.map(s => ALL_SERVICES[s] || s).join(', ')}`,
            status: 'success',
          });
        } catch (err) {
          resultDetails.push({
            clientName: client.name,
            entityLabel: 'שירותים',
            description: `שגיאה: ${err.message}`,
            status: 'error',
          });
        }
      }

      const successCount = resultDetails.filter(r => r.status === 'success').length;
      const errorCount = resultDetails.filter(r => r.status === 'error').length;

      setBulkResult({
        clients: resultDetails.length,
        created: successCount,
        warnings: 0,
        errors: errorCount,
        details: resultDetails.length > 0 ? resultDetails : [{
          clientName: '-',
          entityLabel: 'שירותים',
          description: 'כל הלקוחות כבר מעודכנים - לא נדרש שינוי',
          status: 'success',
        }],
      });
    } catch (err) {
      console.error('Service link scan error:', err);
      setBulkResult({ error: err.message });
    } finally {
      setRunningRuleId(null);
    }
  };

  // STEP 1: Scan existing clients using SELECTED rules only
  const handleBulkScan = async (overrideRuleIds) => {
    setShowRulePicker(false);
    setBulkScanning(true);
    setBulkResult(null);
    setBulkPreview(null);

    const ruleIdsToUse = overrideRuleIds || selectedRuleIds;
    const selectedRules = rules.filter(r => ruleIdsToUse.includes(r.id));

    try {
      const allClients = await Client.list(null, 5000);
      const activeClients = allClients.filter(c => c.status === 'active');

      const year = String(new Date().getFullYear() - 1);
      const now = new Date();

      // Build month range from startMonth/startYear to current month
      const months = [];
      let iterYear = startYear;
      let iterMonth = startMonth;
      while (iterYear < now.getFullYear() || (iterYear === now.getFullYear() && iterMonth <= now.getMonth())) {
        const monthEnd = new Date(iterYear, iterMonth + 1, 0);
        const monthLabel = monthEnd.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        months.push({ year: iterYear, month: iterMonth, monthEnd, monthLabel, dueDateStr: monthEnd.toISOString().split('T')[0] });
        iterMonth++;
        if (iterMonth > 11) { iterMonth = 0; iterYear++; }
      }

      // Use last month for default due date
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const dueDateStr = currentMonthEnd.toISOString().split('T')[0];

      const [existingReports, existingBS, existingRecs, existingTasks, allAccounts] = await Promise.all([
        PeriodicReport.list(null, 5000).catch(() => []),
        BalanceSheet.list(null, 5000).catch(() => []),
        AccountReconciliation.list(null, 5000).catch(() => []),
        Task.list(null, 10000).catch(() => []),
        ClientAccount.list(null, 5000).catch(() => []),
      ]);

      const previewItems = [];

      for (const client of activeClients) {
        const services = client.service_types || [];
        if (services.length === 0) continue;

        const matchingRules = getReportAutoCreateRules(selectedRules, services, client);
        if (matchingRules.length === 0) continue;

        for (const rule of matchingRules) {
          const ruleInfo = { ruleId: rule.id, ruleName: rule.name };

          if (rule.target_entity === 'PeriodicReport' && rule.report_types) {
            const clientReports = existingReports.filter(r => r.client_id === client.id && r.report_year === year);
            if (clientReports.length === 0) {
              for (const [typeKey, periods] of Object.entries(rule.report_types)) {
                for (const period of periods) {
                  const y = parseInt(year);
                  const targetDate = period === 'h1' ? `${y}-07-18` : period === 'h2' ? `${y + 1}-01-18` : `${y + 1}-04-30`;
                  previewItems.push({
                    ...ruleInfo,
                    id: `${client.id}_pr_${typeKey}_${period}`,
                    checked: true,
                    clientId: client.id,
                    clientName: client.name,
                    entity: 'PeriodicReport',
                    entityLabel: 'דיווח מרכז',
                    description: `${PERIODIC_REPORT_TYPES[typeKey] || typeKey} - ${PERIODIC_REPORT_PERIODS[period] || period} (${year})`,
                    createData: {
                      client_id: client.id, client_name: client.name,
                      report_year: year, report_type: typeKey, period,
                      target_date: targetDate, status: 'not_started',
                      reconciliation_steps: { payroll_vs_bookkeeping: false, periodic_vs_annual: false },
                      submission_date: '', notes: '',
                    },
                  });
                }
              }
            }
          }

          if (rule.target_entity === 'BalanceSheet') {
            const clientBS = existingBS.filter(b => b.client_id === client.id && b.tax_year === year);
            if (clientBS.length === 0) {
              previewItems.push({
                ...ruleInfo,
                id: `${client.id}_bs`,
                checked: true,
                clientId: client.id,
                clientName: client.name,
                entity: 'BalanceSheet',
                entityLabel: 'מאזן שנתי',
                description: `מאזן ${year}`,
                createData: {
                  client_name: client.name, client_id: client.id,
                  tax_year: year, current_stage: 'closing_operations',
                  target_date: `${parseInt(year) + 1}-05-31`,
                  folder_link: '', notes: '',
                },
              });
            }
          }

          if (rule.target_entity === 'AccountReconciliation') {
            const clientAccounts = allAccounts.filter(a => a.client_id === client.id);
            if (clientAccounts.length > 0) {
              for (const m of months) {
                const period = m.monthLabel;
                for (const account of clientAccounts) {
                  const exists = existingRecs.some(r => r.client_id === client.id && r.client_account_id === account.id && r.period === period);
                  if (!exists) {
                    previewItems.push({
                      ...ruleInfo,
                      id: `${client.id}_rec_${account.id}_${m.year}_${m.month}`,
                      checked: true,
                      clientId: client.id,
                      clientName: client.name,
                      entity: 'AccountReconciliation',
                      entityLabel: 'התאמת חשבון',
                      description: `${account.account_name || account.bank_name || 'חשבון'} - ${period}`,
                      createData: {
                        client_id: client.id, client_name: client.name,
                        client_account_id: account.id, account_name: account.account_name || account.bank_name || '',
                        period, reconciliation_type: 'bank_credit',
                        status: 'not_started', due_date: m.dueDateStr, notes: '',
                      },
                    });
                  }
                }
              }
            }
          }

          // Task-based boards: generate for EACH month in the range
          if (rule.target_entity?.startsWith('Task_') && rule.task_categories?.length > 0) {
            // Get client reporting frequencies for bi-monthly check
            const reportingInfo = client.reporting_info || {};
            const categoryFrequency = {};
            // Map category → relevant frequency field
            const catFreqMap = {
              'מע"מ': reportingInfo.vat_reporting_frequency,
              'מקדמות מס': reportingInfo.tax_advances_frequency,
              'שכר': reportingInfo.payroll_frequency,
              'ביטוח לאומי': reportingInfo.social_security_frequency,
              'ניכויים': reportingInfo.deductions_frequency,
            };

            for (const m of months) {
              const mStart = new Date(m.year, m.month, 1).toISOString().split('T')[0];
              const mEnd = m.dueDateStr;

              // Calculate due date: use rule's due_day_of_month or end of month
              let taskDueDate;
              if (rule.due_day_of_month) {
                const dueDay = Math.min(rule.due_day_of_month, m.monthEnd.getDate());
                taskDueDate = new Date(m.year, m.month, dueDay).toISOString().split('T')[0];
              } else {
                taskDueDate = mEnd;
              }

              const clientTasks = existingTasks.filter(t =>
                (t.client_id === client.id || t.client_name === client.name) &&
                t.due_date >= mStart && t.due_date <= mEnd
              );
              for (const category of rule.task_categories) {
                // Skip bi-monthly clients on odd months (0-based: Jan=0, Feb=1...)
                const freq = catFreqMap[category];
                if (freq === 'bimonthly' && m.month % 2 !== 0) continue;
                // Skip not_applicable
                if (freq === 'not_applicable') continue;

                // Only count active tasks as existing (not not_relevant)
                const exists = clientTasks.some(t => t.category === category && t.status !== 'not_relevant');
                if (!exists) {
                  previewItems.push({
                    ...ruleInfo,
                    id: `${client.id}_task_${category}_${m.year}_${m.month}`,
                    checked: true,
                    clientId: client.id,
                    clientName: client.name,
                    entity: rule.target_entity,
                    entityLabel: REPORT_ENTITIES[rule.target_entity] || 'משימה',
                    description: `${category} - ${m.monthLabel}`,
                    createData: {
                      title: `${category} - ${client.name} - ${m.monthLabel}`,
                      client_name: client.name, client_id: client.id,
                      category, status: 'not_started', due_date: taskDueDate,
                      context: 'work', process_steps: {},
                    },
                  });
                }
              }
            }
          }
        }
      }

      setBulkPreview({
        items: previewItems,
        totalClients: activeClients.length,
        affectedClients: new Set(previewItems.map(i => i.clientId)).size,
      });
    } catch (err) {
      console.error('Bulk scan error:', err);
      setBulkResult({ error: err.message });
    } finally {
      setBulkScanning(false);
      setRunningRuleId(null);
    }
  };

  // Toggle individual preview item
  const handleTogglePreviewItem = (itemId) => {
    if (!bulkPreview) return;
    setBulkPreview(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
    }));
  };

  // Toggle all items for a specific client
  const handleToggleClientItems = (clientId, checked) => {
    if (!bulkPreview) return;
    setBulkPreview(prev => ({
      ...prev,
      items: prev.items.map(item => item.clientId === clientId ? { ...item, checked } : item),
    }));
  };

  // STEP 2: Execute only checked items, then VERIFY each one was created
  const handleBulkExecute = async () => {
    if (!bulkPreview) return;
    const checkedItems = bulkPreview.items.filter(i => i.checked);
    if (checkedItems.length === 0) { setBulkPreview(null); return; }

    setBulkExecuting(true);
    const resultDetails = []; // detailed log of each action

    for (const item of checkedItems) {
      try {
        let createdRecord = null;
        if (item.entity === 'PeriodicReport') {
          createdRecord = await PeriodicReport.create(item.createData);
        } else if (item.entity === 'BalanceSheet') {
          createdRecord = await BalanceSheet.create(item.createData);
        } else if (item.entity === 'AccountReconciliation') {
          createdRecord = await AccountReconciliation.create(item.createData);
        } else if (item.entity?.startsWith('Task_')) {
          createdRecord = await Task.create(item.createData);
        }

        // VERIFY: check the record was actually created with an ID
        if (createdRecord && createdRecord.id) {
          resultDetails.push({
            clientName: item.clientName,
            entityLabel: item.entityLabel,
            description: item.description,
            status: 'success',
            recordId: createdRecord.id,
          });
        } else {
          resultDetails.push({
            clientName: item.clientName,
            entityLabel: item.entityLabel,
            description: item.description,
            status: 'warning',
            message: 'נוצר אך לא התקבל אישור ID',
          });
        }
      } catch (err) {
        resultDetails.push({
          clientName: item.clientName,
          entityLabel: item.entityLabel,
          description: item.description,
          status: 'error',
          message: err.message,
        });
      }
    }

    const successCount = resultDetails.filter(r => r.status === 'success').length;
    const errorCount = resultDetails.filter(r => r.status === 'error').length;
    const warningCount = resultDetails.filter(r => r.status === 'warning').length;

    setBulkResult({
      clients: bulkPreview.affectedClients,
      created: successCount,
      warnings: warningCount,
      errors: errorCount,
      details: resultDetails,
    });
    setBulkPreview(null);
    setBulkExecuting(false);
  };

  const serviceAutoLinkRules = rules.filter(r => r.type === 'service_auto_link');
  const reportAutoCreateRules = rules.filter(r => r.type === 'report_auto_create');

  // Group report rules by target entity
  const reportRulesByEntity = {};
  for (const r of reportAutoCreateRules) {
    const entity = r.target_entity || 'other';
    if (!reportRulesByEntity[entity]) reportRulesByEntity[entity] = [];
    reportRulesByEntity[entity].push(r);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">אוטומציות</h1>
            <p className="text-gray-500 text-sm">חוקים אוטומטיים שרצים בעת הוספה ועדכון לקוחות</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="text-green-600 flex items-center gap-1 text-sm"><CheckCircle className="w-4 h-4" /> נשמר</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 flex items-center gap-1 text-sm"><AlertTriangle className="w-4 h-4" /> שגיאה</span>
          )}
          <Button variant="outline" size="sm" onClick={handleResetDefaults} className="gap-1">
            <Settings className="w-4 h-4" /> איפוס לברירת מחדל
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkCleanup}
            disabled={cleanupScanning}
            className="gap-1 border-red-300 text-red-600 hover:bg-red-50"
          >
            {cleanupScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {cleanupScanning ? 'מנקה...' : 'ניקוי משימות שירותים שהוסרו'}
          </Button>
          <Button
            size="sm"
            onClick={handleOpenRulePicker}
            disabled={bulkScanning}
            className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {bulkScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {bulkScanning ? 'סורק...' : 'הפעל על לקוחות קיימים'}
          </Button>
        </div>
      </div>

      {/* Cleanup result */}
      {cleanupResult && (
        <Card className={`mb-4 ${cleanupResult.error ? 'border-red-300' : 'border-teal-300'}`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {cleanupResult.error ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-teal-600" />}
              תוצאות ניקוי משימות
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCleanupResult(null)}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {cleanupResult.error ? (
              <p className="text-red-700">שגיאה: {cleanupResult.error}</p>
            ) : cleanupResult.cleaned === 0 ? (
              <p className="text-teal-700 font-medium">לא נמצאו משימות לניקוי - הכל תקין!</p>
            ) : (
              <>
                <p className="text-teal-700 font-medium mb-2">סומנו {cleanupResult.cleaned} משימות כ"לא רלוונטי"</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {cleanupResult.details.map((d, i) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded bg-gray-50">
                      <span className="font-medium text-gray-700">{d.clientName}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-500 truncate max-w-[180px]">{d.taskTitle}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{d.category}</Badge>
                      {d.reason && <span className="text-[9px] text-amber-600">({d.reason})</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk execution result with verification details */}
      {bulkResult && (
        <Card className={`mb-4 ${bulkResult.error ? 'border-red-300' : 'border-green-300'}`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              תוצאות הפעלה - אימות בוצע
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setBulkResult(null)}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {bulkResult.error ? (
              <p className="text-red-700">שגיאה כללית: {bulkResult.error}</p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <span className="text-green-700 font-medium">נוצרו ואומתו: {bulkResult.created}</span>
                  {bulkResult.warnings > 0 && <span className="text-yellow-700">אזהרות: {bulkResult.warnings}</span>}
                  {bulkResult.errors > 0 && <span className="text-red-700">שגיאות: {bulkResult.errors}</span>}
                </div>
                {bulkResult.details && bulkResult.details.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-right p-2">סטטוס</th>
                          <th className="text-right p-2">לקוח</th>
                          <th className="text-right p-2">סוג</th>
                          <th className="text-right p-2">פירוט</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResult.details.map((d, i) => (
                          <tr key={i} className={`border-t ${d.status === 'error' ? 'bg-red-50' : d.status === 'warning' ? 'bg-yellow-50' : ''}`}>
                            <td className="p-2">
                              {d.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                              {d.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />}
                              {d.status === 'error' && <X className="w-3.5 h-3.5 text-red-600" />}
                            </td>
                            <td className="p-2 font-medium">{d.clientName}</td>
                            <td className="p-2">{d.entityLabel}</td>
                            <td className="p-2">{d.description}{d.message ? ` - ${d.message}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Service Auto-Link Rules */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800">שירותים</Badge>
            סימון שירות אוטומטי
          </CardTitle>
          <Button size="sm" onClick={() => { setNewRuleType('service_auto_link'); setEditingRule(getEmptyRule('service_auto_link')); }} className="gap-1">
            <Plus className="w-4 h-4" /> חוק חדש
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm mb-4">כשנבחר שירות מסוים ללקוח, שירותים קשורים יסומנו אוטומטית</p>
          {serviceAutoLinkRules.length === 0 ? (
            <p className="text-gray-400 text-center py-4">אין חוקים מסוג זה</p>
          ) : (
            <div className="space-y-2">
              {serviceAutoLinkRules.map(rule => (
                <RuleRow key={rule.id} rule={rule} onToggle={handleToggleRule} onEdit={setEditingRule} onDelete={handleDeleteRule} onRun={handleRunSingleRule} isRunning={runningRuleId === rule.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Auto-Create Rules - grouped by board */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800">לוחות</Badge>
            יצירה אוטומטית בלוחות
          </CardTitle>
          <Button size="sm" onClick={() => { setNewRuleType('report_auto_create'); setEditingRule(getEmptyRule('report_auto_create')); }} className="gap-1">
            <Plus className="w-4 h-4" /> חוק חדש
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm mb-4">כששומרים לקוח פעיל עם שירותים מסוימים, נוצרות רשומות אוטומטית בלוחות הרלוונטיים</p>

          {Object.keys(REPORT_ENTITIES).map(entityKey => {
            const entityRules = reportRulesByEntity[entityKey] || [];
            const cfg = entityDisplayConfig[entityKey] || {};
            return (
              <div key={entityKey} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`text-xs ${cfg.color || 'bg-gray-100'}`}>{REPORT_ENTITIES[entityKey]}</Badge>
                  <span className="text-xs text-gray-400">{entityRules.length} חוקים</span>
                </div>
                {entityRules.length === 0 ? (
                  <p className="text-gray-400 text-xs mr-4 mb-2">אין חוקים ללוח זה</p>
                ) : (
                  <div className="space-y-2 mr-2">
                    {entityRules.map(rule => (
                      <RuleRow key={rule.id} rule={rule} onToggle={handleToggleRule} onEdit={setEditingRule} onDelete={handleDeleteRule} onRun={handleRunSingleRule} isRunning={runningRuleId === rule.id} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">איך זה עובד?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p><strong>חוקי סימון שירות:</strong> כשאת בוחרת שירות בכרטיס לקוח, שירותים קשורים יסומנו אוטומטית. למשל: בחירת "שכר" תסמן גם "ביטוח לאומי" ו"ניכויים".</p>
          <p><strong>חוקי יצירה בלוחות:</strong> כששומרים לקוח פעיל עם שירותים מסוימים, נוצרות רשומות אוטומטית:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li><strong>דיווחים מרכזים:</strong> שורות 126 (ביטוח לאומי, ניכויים) לפי תקופות</li>
            <li><strong>מאזנים:</strong> שורת מאזן שנתי ללקוח</li>
            <li><strong>התאמות:</strong> שורות התאמה לחשבונות הלקוח</li>
            <li><strong>ריכוז חודשי:</strong> משימות דיווח חודשי (מע"מ, מקדמות, שכר וכו')</li>
            <li><strong>דיווחי מיסים:</strong> משימות דיווחי מיסים חודשיים</li>
            <li><strong>שכר:</strong> משימות שכר ודיווחי רשויות</li>
          </ul>
          <p><strong>תנאים:</strong> ניתן להגביל חוק לסוג עסק מסוים (למשל: רק חברות בע"מ).</p>
          <p><strong>הפעלה/כיבוי:</strong> כל חוק ניתן להפעלה או כיבוי בלחיצה בלי למחוק אותו.</p>
        </CardContent>
      </Card>

      {/* Rule Editor Dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => { if (!open) { setEditingRule(null); setNewRuleType(null); } }}>
        {editingRule && (
          <RuleEditor
            rule={editingRule}
            onSave={handleSaveRule}
            onCancel={() => { setEditingRule(null); setNewRuleType(null); }}
          />
        )}
      </Dialog>

      {/* Rule Picker Dialog - Step 0: Choose which rules to run */}
      <Dialog open={showRulePicker} onOpenChange={(open) => { if (!open) setShowRulePicker(false); }}>
        <DialogContent className="bg-white max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              בחירת אוטומציות להפעלה
            </DialogTitle>
            <DialogDescription>
              סמני אילו חוקים להריץ על הלקוחות הפעילים. רק חוקי יצירת רשומות (לא חוקי סימון שירות).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {rules.filter(r => r.type === 'report_auto_create').map(rule => {
              const isSelected = selectedRuleIds.includes(rule.id);
              const cfg = entityDisplayConfig[rule.target_entity] || {};
              return (
                <div
                  key={rule.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                  } ${!rule.enabled ? 'opacity-50' : ''}`}
                  onClick={() => handleToggleRuleSelection(rule.id)}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-yellow-600 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rule.name}</span>
                      {!rule.enabled && <Badge variant="outline" className="text-[10px] text-orange-600">מושבת</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{rule.description}</p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${cfg.color || 'bg-gray-100'}`}>
                    {cfg.label || rule.target_entity}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Starting from month/year */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-500" />
              <Label className="text-sm font-medium">החל מחודש:</Label>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(parseInt(v))}>
                <SelectTrigger className="w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'].map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={(v) => setStartYear(parseInt(v))}>
                <SelectTrigger className="w-24 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {[...Array(3)].map((_, i) => {
                    const y = new Date().getFullYear() - 1 + i;
                    return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-400">עד החודש הנוכחי</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRuleIds(rules.filter(r => r.type === 'report_auto_create').map(r => r.id))}>
                סמן הכל
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRuleIds([])}>
                נקה הכל
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRulePicker(false)}>ביטול</Button>
              <Button
                onClick={() => handleBulkScan()}
                disabled={selectedRuleIds.length === 0}
                className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                <Play className="w-4 h-4" />
                סרוק ({selectedRuleIds.length} חוקים)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Preview Dialog */}
      <Dialog open={!!bulkPreview} onOpenChange={(open) => { if (!open && !bulkExecuting) setBulkPreview(null); }}>
        <DialogContent className="bg-white max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-yellow-500" />
              תצוגה מקדימה - אוטומציות ללקוחות קיימים
            </DialogTitle>
            <DialogDescription>
              {bulkPreview && (
                <>
                  נסרקו {bulkPreview.totalClients} לקוחות פעילים.
                  {' '}נמצאו <strong>{bulkPreview.items.length}</strong> רשומות חדשות ליצירה
                  {' '}עבור <strong>{bulkPreview.affectedClients}</strong> לקוחות.
                  {bulkPreview.items.length === 0 && ' הכל כבר קיים!'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {bulkPreview && bulkPreview.items.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm px-1 py-2 border-b">
                <span className="text-gray-500">
                  מסומנים: {bulkPreview.items.filter(i => i.checked).length} / {bulkPreview.items.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setBulkPreview(prev => ({ ...prev, items: prev.items.map(i => ({ ...i, checked: true })) }))}>
                    סמן הכל
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBulkPreview(prev => ({ ...prev, items: prev.items.map(i => ({ ...i, checked: false })) }))}>
                    נקה הכל
                  </Button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0">
                {/* Group by client */}
                {(() => {
                  const grouped = {};
                  for (const item of bulkPreview.items) {
                    if (!grouped[item.clientId]) grouped[item.clientId] = { name: item.clientName, items: [] };
                    grouped[item.clientId].items.push(item);
                  }
                  return Object.entries(grouped).map(([clientId, group]) => {
                    const allChecked = group.items.every(i => i.checked);
                    const someChecked = group.items.some(i => i.checked);
                    return (
                      <div key={clientId} className="border-b last:border-b-0">
                        <div
                          className="flex items-center gap-2 p-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
                          onClick={() => handleToggleClientItems(clientId, !allChecked)}
                        >
                          {allChecked ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : someChecked ? (
                            <CheckSquare className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300" />
                          )}
                          <span className="font-medium text-sm">{group.name}</span>
                          <Badge variant="secondary" className="text-xs">{group.items.length} רשומות</Badge>
                        </div>
                        <div className="pr-6">
                          {group.items.map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-2 p-1.5 text-xs cursor-pointer hover:bg-gray-50 ${!item.checked ? 'opacity-50' : ''}`}
                              onClick={() => handleTogglePreviewItem(item.id)}
                            >
                              {item.checked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                              )}
                              <Badge className={`text-[10px] shrink-0 ${(entityDisplayConfig[item.entity] || {}).color || 'bg-gray-100'}`}>
                                {item.entityLabel}
                              </Badge>
                              <span className="truncate">{item.description}</span>
                              {item.ruleName && <span className="text-[10px] text-gray-400 shrink-0">({item.ruleName})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <Button variant="outline" onClick={() => setBulkPreview(null)} disabled={bulkExecuting}>ביטול</Button>
                <Button
                  onClick={handleBulkExecute}
                  disabled={bulkExecuting || bulkPreview.items.filter(i => i.checked).length === 0}
                  className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {bulkExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {bulkExecuting ? 'מבצע...' : `אשר והפעל (${bulkPreview.items.filter(i => i.checked).length})`}
                </Button>
              </div>
            </>
          )}

          {bulkPreview && bulkPreview.items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium">הכל מעודכן!</p>
              <p className="text-sm">כל הרשומות כבר קיימות לכל הלקוחות הפעילים</p>
              <Button variant="outline" className="mt-4" onClick={() => setBulkPreview(null)}>סגור</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
