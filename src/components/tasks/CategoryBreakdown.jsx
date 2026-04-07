import React, { useMemo } from "react";
import { getServiceWeight } from "@/config/serviceWeights";
import { FileText, CreditCard, Wrench } from "lucide-react";

/**
 * Classify a task into one of 3 work phases:
 *   fromScratch  — "מהתחלה"     : no steps done, full process needed
 *   reporting    — "דיווח/תשלום" : main work done, only submission/payment left
 *   completions  — "השלמות"      : small fixes, corrections, waiting for materials
 */
function classifyPhase(task) {
  const st = task.status;

  // Corrections / review → small completions
  if (st === 'needs_corrections' || st === 'sent_for_review' || st === 'ready_to_broadcast' || st === 'reported_pending_payment') return 'completions';

  // Waiting for materials → completions (blocked but almost done)
  if (st === 'waiting_for_materials') return 'completions';

  // If process_steps exist, check how far along
  const steps = task.process_steps;
  if (steps && typeof steps === 'object') {
    const keys = Object.keys(steps);
    const doneCount = keys.filter(k => steps[k]?.done).length;
    const total = keys.length;

    if (total > 0 && doneCount > 0) {
      // Some work done — check if only reporting/payment remain
      const remaining = keys.filter(k => !steps[k]?.done);
      const isOnlyReportPayment = remaining.every(k =>
        k === 'submission' || k === 'payment' || k === 'report_prep'
      );
      if (isOnlyReportPayment && remaining.length <= 2) return 'reporting';
      // Partially done but still significant work → completions
      return 'completions';
    }
  }

  // Default: from scratch
  return 'fromScratch';
}

const PHASE_CONFIG = {
  fromScratch: {
    label: 'מהתחלה',
    icon: FileText,
    color: '#7B9FE8',
    bg: '#EEF2FB',
  },
  reporting: {
    label: 'דיווח / תשלום',
    icon: CreditCard,
    color: '#7DD3A0',
    bg: '#EDF7F1',
  },
  completions: {
    label: 'השלמות',
    icon: Wrench,
    color: '#F5B882',
    bg: '#FDF3EA',
  },
};

export default function CategoryBreakdown({ tasks }) {
  const breakdown = useMemo(() => {
    // Only active (non-completed) tasks with a category
    const active = tasks.filter(t =>
      t.status !== 'production_completed' &&
      t.status !== 'not_relevant' &&
      t.category
    );

    // Group by category
    const byCat = {};
    active.forEach(task => {
      const cat = task.category;
      if (!byCat[cat]) byCat[cat] = { fromScratch: [], reporting: [], completions: [] };
      const phase = classifyPhase(task);
      byCat[cat][phase].push(task);
    });

    // Convert to sorted array (most tasks first)
    return Object.entries(byCat)
      .map(([category, phases]) => {
        const total = phases.fromScratch.length + phases.reporting.length + phases.completions.length;
        const sw = getServiceWeight(category);
        const estimateMin = (arr) => arr.reduce((sum, t) => sum + (t.estimated_duration || sw.duration), 0);
        return {
          category,
          label: sw.label || category,
          total,
          phases: {
            fromScratch: { count: phases.fromScratch.length, minutes: estimateMin(phases.fromScratch) },
            reporting:    { count: phases.reporting.length,    minutes: estimateMin(phases.reporting) },
            completions:  { count: phases.completions.length,  minutes: estimateMin(phases.completions) },
          },
        };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [tasks]);

  if (breakdown.length === 0) return null;

  const formatTime = (min) => {
    if (min === 0) return '';
    if (min < 60) return `${min}′`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}′` : `${h}h`;
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      <h3 className="text-sm font-bold text-slate-600 px-1">סיכום היום לפי קטגוריה</h3>

      <div className="space-y-2">
        {breakdown.map(({ category, label, total, phases }) => (
          <div key={category} className="rounded-xl px-3 py-2.5" style={{ border: '1px solid #F0F0F0', background: '#FAFAFA' }}>
            {/* Category header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-slate-700">{label}</span>
              <span className="text-[11px] text-slate-400 font-medium">{total} משימות</span>
            </div>

            {/* Phase pills */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(PHASE_CONFIG).map(([phaseKey, cfg]) => {
                const p = phases[phaseKey];
                if (p.count === 0) return null;
                const Icon = cfg.icon;
                return (
                  <div
                    key={phaseKey}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{p.count}</span>
                    <span className="text-[10px] opacity-80">{cfg.label}</span>
                    {p.minutes > 0 && (
                      <span className="text-[10px] opacity-60 mr-0.5">· {formatTime(p.minutes)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
