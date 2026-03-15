import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Timer, Info, ChevronDown, ChevronLeft, ArrowLeft } from 'lucide-react';
import {
  DEFAULT_EXECUTION_PERIODS,
  loadExecutionPeriods,
  saveExecutionPeriods,
} from '@/config/automationRules';
import { ALL_SERVICES } from '@/config/processTemplates';
import { toast } from 'sonner';

/**
 * Map services to P-branches based on dashboard + explicit branch field.
 * This connects the execution period settings to the actual process tree.
 */
const DASHBOARD_TO_BRANCH = {
  payroll: 'P1',
  tax: 'P2',
  admin: 'P3',
  additional: 'P2',
  annual_reports: 'P5',
  home: null, // P4 — excluded from work views
};

const BRANCH_CONFIG = {
  P1: {
    label: 'P1 | חשבות שכר',
    color: 'bg-sky-50',
    border: 'border-sky-300',
    badge: 'bg-sky-100 text-sky-800',
    dot: 'bg-sky-500',
    headerBg: 'bg-sky-100/70',
  },
  P2: {
    label: 'P2 | הנהלת חשבונות',
    color: 'bg-purple-50',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-800',
    dot: 'bg-purple-500',
    headerBg: 'bg-purple-100/70',
  },
  P3: {
    label: 'P3 | ניהול ותכנון',
    color: 'bg-pink-50',
    border: 'border-pink-300',
    badge: 'bg-pink-100 text-pink-800',
    dot: 'bg-pink-500',
    headerBg: 'bg-pink-100/70',
  },
  P5: {
    label: 'P5 | דוחות שנתיים',
    color: 'bg-green-50',
    border: 'border-green-300',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    headerBg: 'bg-green-100/70',
  },
};

// Standard deadline days (from tax calendar)
const DEADLINE_MAP = {
  'מע"מ': 19,
  'מע"מ 874': 23,
  'מקדמות מס': 19,
  'שכר': 15,
  'ביטוח לאומי': 15,
  'ניכויים': 19,
  'מס"ב סוציאליות': 15,
  'מס"ב עובדים': 10,
  'מס"ב רשויות': 15,
  'מס"ב ספקים': 15,
  'תשלום רשויות': 19,
  'משלוח תלושים': 10,
  'הנהלת חשבונות': 28,
  'התאמות': 28,
};

function getBranchForService(service) {
  if (service.branch) return service.branch;
  return DASHBOARD_TO_BRANCH[service.dashboard] || null;
}

/**
 * Visual mini-timeline bar showing start → deadline
 */
function TimelineBar({ startDay, deadline }) {
  if (!startDay || !deadline) return null;
  const startPct = ((startDay - 1) / 30) * 100;
  const endPct = ((deadline - 1) / 30) * 100;
  const width = Math.max(endPct - startPct, 3);

  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden" title={`יום ${startDay} → יום ${deadline}`}>
      <div
        className="absolute top-0 h-full rounded-full bg-gradient-to-l from-red-300 to-emerald-400 opacity-60"
        style={{ right: `${startPct}%`, width: `${width}%` }}
      />
      {/* Start marker */}
      <div
        className="absolute top-0 h-full w-1 bg-emerald-600 rounded-full"
        style={{ right: `${startPct}%` }}
        title={`התחלה: ${startDay}`}
      />
      {/* Deadline marker */}
      <div
        className="absolute top-0 h-full w-1 bg-red-500 rounded-full"
        style={{ right: `${endPct}%` }}
        title={`דדליין: ${deadline}`}
      />
    </div>
  );
}

export default function ExecutionPeriodSettings() {
  const [periods, setPeriods] = useState({});
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedBranches, setCollapsedBranches] = useState(new Set());

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    const result = await loadExecutionPeriods();
    setPeriods(result.periods);
    setConfigId(result.configId);
    setIsLoading(false);
  };

  const handleChange = (category, field, value) => {
    setPeriods(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value === '' ? null : Number(value),
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newId = await saveExecutionPeriods(configId, periods);
      if (newId) setConfigId(newId);
      toast.success('תבניות תקופות ביצוע נשמרו');
    } catch {
      toast.error('שגיאה בשמירה');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setPeriods({ ...DEFAULT_EXECUTION_PERIODS });
    toast.info('אופס לברירת מחדל');
  };

  const toggleBranch = (branchId) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId); else next.add(branchId);
      return next;
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">טוען תבניות...</div>;
  }

  // Group all services by P-branch
  const branchGroups = {};
  for (const service of Object.values(ALL_SERVICES)) {
    const branch = getBranchForService(service);
    if (!branch || !BRANCH_CONFIG[branch]) continue; // skip P4/null
    if (!service.createCategory) continue;
    if (!branchGroups[branch]) branchGroups[branch] = [];
    // Dedupe by createCategory
    if (branchGroups[branch].some(s => s.category === service.createCategory)) continue;
    branchGroups[branch].push({
      serviceKey: service.key,
      category: service.createCategory,
      label: service.label,
      deadline: DEADLINE_MAP[service.createCategory] || null,
    });
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="w-5 h-5 text-gray-600" />
          תקופות ביצוע ויעדים — לפי ענף
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          לכל שירות, הגדירי מתי מתחילים לעבוד ומתי הדדליין.
          כאשר נוצרת משימה — תקופת הביצוע תמולא אוטומטית.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simple explanation */}
        <div className="bg-gray-50 rounded-lg p-3 flex gap-2 text-xs text-gray-600 border border-gray-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1" /> <strong>יום התחלה</strong> — באיזה יום בחודש מתחילים (למשל 1, 5, 15)</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1" /> <strong>דדליין</strong> — יום אחרון לדיווח (מלוח מועדים)</div>
            <div><ArrowLeft className="w-3 h-3 inline ml-1 text-gray-400" /> <strong>ימי מרווח</strong> — כמה ימים לפני הדדליין להתחיל (חלופה ליום התחלה קבוע)</div>
          </div>
        </div>

        {/* Branch sections */}
        {Object.entries(BRANCH_CONFIG).map(([branchId, branchCfg]) => {
          const services = branchGroups[branchId] || [];
          if (services.length === 0) return null;
          const isCollapsed = collapsedBranches.has(branchId);

          return (
            <div key={branchId} className={`rounded-xl border-2 ${branchCfg.border} overflow-hidden`}>
              {/* Branch header */}
              <button
                type="button"
                onClick={() => toggleBranch(branchId)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 ${branchCfg.headerBg} transition-colors hover:opacity-90`}
              >
                <div className={`w-3 h-3 rounded-full ${branchCfg.dot}`} />
                <span className="text-sm font-black text-gray-800 flex-1 text-right">{branchCfg.label}</span>
                <Badge className={`${branchCfg.badge} text-[10px]`}>{services.length} שירותים</Badge>
                {isCollapsed ?
                  <ChevronLeft className="w-4 h-4 text-gray-400" /> :
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {!isCollapsed && (
                <div className={`${branchCfg.color} p-3 space-y-1`}>
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_70px_70px_70px_1fr] gap-2 text-[10px] text-gray-500 font-bold px-2 pb-1 border-b border-gray-200/60">
                    <span>שירות</span>
                    <span className="text-center">התחלה</span>
                    <span className="text-center">דדליין</span>
                    <span className="text-center">מרווח</span>
                    <span className="text-center">ציר זמן</span>
                  </div>

                  {services.map(({ category, label, deadline }) => {
                    const p = periods[category] || {};
                    const startDay = p.start_day;
                    const bufferDays = p.buffer_days;
                    // Calculate effective start from buffer if no fixed start
                    const effectiveStart = startDay || (deadline && bufferDays ? Math.max(1, deadline - bufferDays) : null);

                    return (
                      <div
                        key={category}
                        className="grid grid-cols-[1fr_70px_70px_70px_1fr] gap-2 items-center bg-white/80 rounded-lg px-3 py-2 hover:bg-white transition-colors"
                      >
                        {/* Service label */}
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-800 block truncate">{label}</span>
                        </div>

                        {/* Start day */}
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={p.start_day ?? ''}
                          onChange={(e) => handleChange(category, 'start_day', e.target.value)}
                          placeholder="—"
                          className="text-center text-sm h-7 bg-emerald-50 border-emerald-200 focus:border-emerald-400"
                        />

                        {/* Deadline (read-only from calendar) */}
                        <div className="text-center">
                          {deadline ? (
                            <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                              {deadline}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>

                        {/* Buffer days */}
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={p.buffer_days ?? ''}
                          onChange={(e) => handleChange(category, 'buffer_days', e.target.value)}
                          placeholder="—"
                          className="text-center text-sm h-7 bg-amber-50 border-amber-200 focus:border-amber-400"
                        />

                        {/* Visual timeline */}
                        <TimelineBar startDay={effectiveStart} deadline={deadline} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'שמור תבניות'}
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            אפס לברירת מחדל
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
