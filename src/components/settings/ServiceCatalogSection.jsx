import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ServiceCatalog } from '@/api/entities';
import { ALL_SERVICES } from '@/config/processTemplates';
import {
  BookOpen, CheckCircle, ChevronDown, ChevronUp, Database,
  GripVertical, Loader2, Pencil, Plus, Save, Trash2, X, AlertTriangle
} from 'lucide-react';

// ── Branch / dashboard grouping for display ──
const SERVICE_GROUPS = [
  {
    key: 'tax',
    label: 'P2 | הנהלת חשבונות ומיסים',
    color: 'border-blue-200 bg-blue-50/50',
    badge: 'bg-blue-100 text-blue-700',
    keys: ['vat', 'tax_advances', 'vat_874', 'bookkeeping', 'expense_collection', 'income_collection', 'reconciliation', 'bank_reconciliation', 'credit_card_reconciliation', 'annual_reports', 'consulting'],
  },
  {
    key: 'payroll',
    label: 'P1 | חשבות שכר',
    color: 'border-emerald-200 bg-emerald-50/50',
    badge: 'bg-emerald-100 text-emerald-700',
    keys: ['payroll', 'social_security', 'deductions', 'authorities_payment', 'reserve_claims',
           'social_benefits', 'masav_employees', 'masav_social', 'masav_suppliers',
           'payslip_sending'],
  },
  {
    key: 'reporting',
    label: 'דיווחים נוספים',
    color: 'border-purple-200 bg-purple-50/50',
    badge: 'bg-purple-100 text-purple-700',
    keys: ['operator_reporting', 'taml_reporting'],
  },
  {
    key: 'admin',
    label: 'אדמיניסטרציה',
    color: 'border-gray-200 bg-gray-50/50',
    badge: 'bg-gray-100 text-gray-700',
    keys: ['admin', 'marketing_followup', 'client_callback', 'meeting', 'general'],
  },
];

// ── Build default catalog from processTemplates ──
function buildDefaultCatalog() {
  return Object.entries(ALL_SERVICES).map(([key, svc]) => ({
    service_key: key,
    label: svc.label,
    dashboard: svc.dashboard || 'admin',
    task_type: svc.taskType || 'linear',
    category: svc.createCategory || svc.label,
    is_active: true,
    supports_complexity: !!svc.supportsComplexity,
    sequential_steps: !!svc.sequentialSteps,
    steps: (svc.steps || []).map((s, i) => ({
      key: s.key,
      label: s.label,
      icon: s.icon || 'check-circle',
      order: i,
      allow_multiple: !!s.allowMultiple,
      requires_prev: !!s.requiresPrev,
    })),
    high_complexity_steps: (svc.highComplexitySteps || []).map((s, i) => ({
      key: s.key,
      label: s.label,
      icon: s.icon || 'check-circle',
      order: i,
    })),
  }));
}

// ── ICON name to mini display ──
const STEP_ICON_LABELS = {
  'download': 'DL', 'inbox': 'IN', 'file-text': 'DOC', 'send': 'TX', 'landmark': 'PAY',
  'calculator': 'CALC', 'check-square': 'CHK', 'check-circle': 'OK', 'eye': 'REV',
  'database': 'DB', 'upload': 'UP', 'phone': 'TEL', 'clock': 'CLK', 'calendar': 'CAL',
  'message-square': 'MSG', 'alert-triangle': 'ALR', 'file-down': 'FDL', 'file-output': 'OUT',
};

export default function ServiceCatalogSection() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedService, setExpandedService] = useState(null);
  const [editingStep, setEditingStep] = useState(null); // { serviceKey, stepIndex }
  const [dirty, setDirty] = useState(false);
  const [counts, setCounts] = useState({ total: 0, active: 0, fromDb: false });

  // ── Load catalog from DB or generate defaults ──
  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const existing = await ServiceCatalog.list(null, 500);
      if (existing.length > 0) {
        setCatalog(existing);
        setCounts({ total: existing.length, active: existing.filter(s => s.is_active).length, fromDb: true });
      } else {
        const defaults = buildDefaultCatalog();
        setCatalog(defaults);
        setCounts({ total: defaults.length, active: defaults.length, fromDb: false });
      }
    } catch (e) {
      console.error('[ServiceCatalog] Load error:', e);
      const defaults = buildDefaultCatalog();
      setCatalog(defaults);
      setCounts({ total: defaults.length, active: defaults.length, fromDb: false });
    }
    setLoading(false);
  };

  // ── Save entire catalog to Supabase ──
  const saveCatalog = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Delete existing then re-create (simpler than diffing)
      await ServiceCatalog.deleteAll();
      for (const svc of catalog) {
        const { id, created_date, updated_date, ...data } = svc;
        await ServiceCatalog.create(data);
      }
      setDirty(false);
      setSaved(true);
      setCounts({ total: catalog.length, active: catalog.filter(s => s.is_active).length, fromDb: true });
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('[ServiceCatalog] Save error:', e);
      alert('שגיאה בשמירה: ' + e.message);
    }
    setSaving(false);
  };

  // ── Seed defaults (overwrite) ──
  const seedDefaults = async () => {
    if (!window.confirm('לאפס את כל השירותים לברירת מחדל?\nשינויים שביצעת יימחקו.')) return;
    const defaults = buildDefaultCatalog();
    setCatalog(defaults);
    setDirty(true);
  };

  // ── Toggle active ──
  const toggleActive = (serviceKey) => {
    setCatalog(prev => prev.map(s =>
      s.service_key === serviceKey ? { ...s, is_active: !s.is_active } : s
    ));
    setDirty(true);
  };

  // ── Step editing ──
  const updateStepLabel = (serviceKey, stepIndex, newLabel) => {
    setCatalog(prev => prev.map(s => {
      if (s.service_key !== serviceKey) return s;
      const steps = [...s.steps];
      steps[stepIndex] = { ...steps[stepIndex], label: newLabel };
      return { ...s, steps };
    }));
    setDirty(true);
  };

  const addStep = (serviceKey) => {
    setCatalog(prev => prev.map(s => {
      if (s.service_key !== serviceKey) return s;
      const steps = [...s.steps, {
        key: `step_${Date.now()}`,
        label: 'שלב חדש',
        icon: 'check-circle',
        order: s.steps.length,
      }];
      return { ...s, steps };
    }));
    setDirty(true);
  };

  const removeStep = (serviceKey, stepIndex) => {
    setCatalog(prev => prev.map(s => {
      if (s.service_key !== serviceKey) return s;
      const steps = s.steps.filter((_, i) => i !== stepIndex);
      return { ...s, steps };
    }));
    setDirty(true);
  };

  const moveStep = (serviceKey, stepIndex, direction) => {
    setCatalog(prev => prev.map(s => {
      if (s.service_key !== serviceKey) return s;
      const steps = [...s.steps];
      const newIndex = stepIndex + direction;
      if (newIndex < 0 || newIndex >= steps.length) return s;
      [steps[stepIndex], steps[newIndex]] = [steps[newIndex], steps[stepIndex]];
      return { ...s, steps: steps.map((st, i) => ({ ...st, order: i })) };
    }));
    setDirty(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">טוען קטלוג שירותים...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              קטלוג שירותים — Service Catalog
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-100 text-indigo-700 text-[12px]">
                {counts.total} שירותים
              </Badge>
              <Badge className="bg-green-100 text-green-700 text-[12px]">
                {counts.active} פעילים
              </Badge>
              {counts.fromDb && (
                <Badge className="bg-blue-100 text-blue-700 text-[12px]">
                  <Database className="w-3 h-3 ml-1" />
                  Supabase
                </Badge>
              )}
              {!counts.fromDb && (
                <Badge className="bg-amber-100 text-amber-700 text-[12px]">
                  <AlertTriangle className="w-3 h-3 ml-1" />
                  טרם נשמר
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-600">
            כל השירותים שהמשרד מציע עם שלבי ה-Workflow שלהם.
            ערוך שלבים, הפעל/כבה שירותים, ושמור ל-Database.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={saveCatalog}
              disabled={saving || (!dirty && counts.fromDb)}
              className="gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? 'שומר...' : counts.fromDb && !dirty ? 'נשמר' : 'שמור ל-Database'}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" /> נשמר בהצלחה!
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={seedDefaults}
              className="gap-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <Database className="w-3 h-3" />
              אפס לברירת מחדל
            </Button>
            {dirty && (
              <Badge className="bg-amber-100 text-amber-700 text-[12px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                יש שינויים שלא נשמרו
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Service Groups ── */}
      {SERVICE_GROUPS.map(group => {
        const groupServices = catalog.filter(s => group.keys.includes(s.service_key));
        if (groupServices.length === 0) return null;

        return (
          <Card key={group.key} className={`border ${group.color}`}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Badge className={`text-[12px] ${group.badge}`}>{group.label}</Badge>
                  <span className="text-[12px] text-gray-400">{groupServices.length} שירותים</span>
                </h3>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {groupServices.map(svc => {
                const isExpanded = expandedService === svc.service_key;
                return (
                  <div key={svc.service_key} className="border rounded-lg bg-white overflow-hidden">
                    {/* ── Service row ── */}
                    <div
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                        !svc.is_active ? 'opacity-50' : ''
                      }`}
                      onClick={() => setExpandedService(isExpanded ? null : svc.service_key)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleActive(svc.service_key); }}
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                          svc.is_active
                            ? 'bg-green-500 border-green-500'
                            : 'bg-gray-200 border-gray-300'
                        }`}
                        title={svc.is_active ? 'פעיל — לחץ לכיבוי' : 'כבוי — לחץ להפעלה'}
                      />

                      <span className="text-sm font-medium text-gray-800 flex-1">{svc.label}</span>

                      <Badge className="bg-gray-100 text-gray-500 text-[12px]">{svc.service_key}</Badge>

                      <div className="flex items-center gap-1">
                        {svc.steps.map((step, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-[11px] rounded bg-indigo-50 text-indigo-600 font-mono"
                            title={step.label}
                          >
                            {STEP_ICON_LABELS[step.icon] || step.icon?.slice(0,3).toUpperCase() || (i + 1)}
                          </span>
                        ))}
                        <span className="text-[12px] text-gray-400 mr-1">{svc.steps.length} שלבים</span>
                      </div>

                      {svc.task_type === 'authority' && (
                        <Badge className="bg-violet-50 text-violet-600 text-[11px]">דיווח+תשלום</Badge>
                      )}
                      {svc.sequential_steps && (
                        <Badge className="bg-amber-50 text-amber-600 text-[11px]">סדרתי</Badge>
                      )}

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>

                    {/* ── Expanded: step editor ── */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-600">שלבי Workflow</span>
                          <div className="flex items-center gap-2 text-[12px] text-gray-400">
                            <span>סוג: {svc.task_type || 'linear'}</span>
                            <span>קטגוריה: {svc.category}</span>
                            <span>דשבורד: {svc.dashboard}</span>
                          </div>
                        </div>

                        {svc.steps.map((step, idx) => {
                          const isEditing = editingStep?.serviceKey === svc.service_key && editingStep?.stepIndex === idx;
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2 rounded border bg-white group"
                            >
                              <span className="text-[12px] text-gray-400 w-5 text-center font-mono">{idx + 1}</span>

                              <span className="px-1.5 py-0.5 text-[11px] rounded bg-indigo-100 text-indigo-600 font-mono w-10 text-center">
                                {STEP_ICON_LABELS[step.icon] || step.icon?.slice(0,3).toUpperCase()}
                              </span>

                              {isEditing ? (
                                <Input
                                  className="h-7 text-xs flex-1"
                                  value={step.label}
                                  onChange={(e) => updateStepLabel(svc.service_key, idx, e.target.value)}
                                  onBlur={() => setEditingStep(null)}
                                  onKeyDown={(e) => e.key === 'Enter' && setEditingStep(null)}
                                  autoFocus
                                />
                              ) : (
                                <span className="text-xs text-gray-700 flex-1">{step.label}</span>
                              )}

                              <span className="text-[12px] text-gray-300 font-mono">{step.key}</span>

                              {step.requires_prev && (
                                <Badge className="bg-amber-50 text-amber-600 text-[7px]">REQ</Badge>
                              )}
                              {step.allow_multiple && (
                                <Badge className="bg-blue-50 text-blue-600 text-[7px]">MULTI</Badge>
                              )}

                              {/* Action buttons - visible on hover */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setEditingStep({ serviceKey: svc.service_key, stepIndex: idx })}
                                  className="p-1 rounded hover:bg-blue-100 text-blue-500"
                                  title="ערוך שם"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveStep(svc.service_key, idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30"
                                  title="הזז למעלה"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveStep(svc.service_key, idx, 1)}
                                  disabled={idx === svc.steps.length - 1}
                                  className="p-1 rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30"
                                  title="הזז למטה"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => removeStep(svc.service_key, idx)}
                                  className="p-1 rounded hover:bg-red-100 text-red-400"
                                  title="מחק שלב"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addStep(svc.service_key)}
                          className="gap-1 text-[12px] border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 w-full h-7"
                        >
                          <Plus className="w-3 h-3" />
                          הוסף שלב
                        </Button>

                        {svc.high_complexity_steps?.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[12px] text-purple-600 cursor-pointer hover:text-purple-800">
                              שלבים מורכבים (High Complexity) — {svc.high_complexity_steps.length} שלבים
                            </summary>
                            <div className="mt-1 space-y-1 p-2 border border-purple-100 rounded bg-purple-50/50">
                              {svc.high_complexity_steps.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <span className="text-[12px] text-purple-400 w-5 text-center">{idx + 1}</span>
                                  <span className="px-1 py-0.5 text-[11px] rounded bg-purple-100 text-purple-600 font-mono">
                                    {STEP_ICON_LABELS[step.icon] || step.icon?.slice(0,3).toUpperCase()}
                                  </span>
                                  <span className="text-purple-700">{step.label}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Summary footer ── */}
      <div className="text-center text-[12px] text-gray-400 py-2">
        {catalog.length} שירותים בקטלוג &bull; {catalog.filter(s => s.is_active).length} פעילים &bull;{' '}
        {catalog.reduce((sum, s) => sum + s.steps.length, 0)} שלבי workflow
      </div>
    </div>
  );
}
