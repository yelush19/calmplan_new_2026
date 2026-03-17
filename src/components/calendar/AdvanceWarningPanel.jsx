import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { TAX_CALENDAR_2026, HEBREW_MONTH_NAMES } from '@/config/taxCalendar2026';

// ── חגים ישראליים 2026 (תאריכים גרגוריאניים) ──
const ISRAELI_HOLIDAYS_2026 = {
  "2026-03-21": { name: "פורים" },
  "2026-04-02": { name: "פסח - ערב חג" },
  "2026-04-03": { name: "פסח א׳" },
  "2026-04-09": { name: "שביעי של פסח" },
  "2026-04-15": { name: "יום העצמאות" },
  "2026-05-22": { name: "שבועות" },
  "2026-09-12": { name: "ראש השנה א׳" },
  "2026-09-13": { name: "ראש השנה ב׳" },
  "2026-09-21": { name: "יום כיפור" },
  "2026-09-26": { name: "סוכות א׳" },
  "2026-10-03": { name: "שמחת תורה" },
};

// ── שמות דדליינים בעברית ──
const DEADLINE_LABELS = {
  payroll: 'שכר',
  nationalInsurance: 'ביטוח לאומי',
  onlineFiling: 'מע"מ / ניכויים / מקדמות',
  detailedVat: 'מע"מ 874',
  masavSocial: 'מס"ב סוציאליות',
  masavAuthorities: 'מס"ב רשויות',
  masavSuppliers: 'מס"ב ספקים',
  operatorReport: 'דיווח למתפעל',
};

function computeWarnings(today) {
  const warnings = [];

  for (let reportMonth = 1; reportMonth <= 12; reportMonth++) {
    const entry = TAX_CALENDAR_2026[reportMonth];
    if (!entry) continue;

    const deadlineFields = ['payroll', 'nationalInsurance', 'onlineFiling', 'detailedVat', 'masavSocial', 'masavAuthorities', 'masavSuppliers', 'operatorReport'];

    for (const field of deadlineFields) {
      const dateStr = entry[field];
      if (!dateStr) continue;

      const deadlineDate = new Date(dateStr);
      const daysUntil = differenceInCalendarDays(deadlineDate, today);

      if (daysUntil < 0 || daysUntil > 14) continue;

      const label = DEADLINE_LABELS[field] || field;
      const reportMonthName = HEBREW_MONTH_NAMES[reportMonth - 1];
      const holiday = ISRAELI_HOLIDAYS_2026[dateStr];

      if (daysUntil <= 3) {
        warnings.push({ date: deadlineDate, dateStr, label, reportMonth: reportMonthName, daysUntil, type: 'urgent', holiday: holiday || null });
      } else if (holiday) {
        warnings.push({ date: deadlineDate, dateStr, label, reportMonth: reportMonthName, daysUntil, type: 'holiday_conflict', holiday });
      } else if (daysUntil <= 7) {
        warnings.push({ date: deadlineDate, dateStr, label, reportMonth: reportMonthName, daysUntil, type: 'upcoming', holiday: null });
      }
    }
  }

  warnings.sort((a, b) => a.daysUntil - b.daysUntil);
  return warnings;
}

export default function AdvanceWarningPanel() {
  const warnings = useMemo(() => computeWarnings(new Date()), []);

  if (warnings.length === 0) return null;

  return (
    <Card className="bg-slate-50/60 border border-slate-200">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
          <Calendar className="w-4 h-4 text-slate-500" />
          דדליינים קרובים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-3">
        {warnings.map((w) => (
          <div
            key={`${w.dateStr}-${w.label}`}
            className={`p-2.5 rounded-lg border flex items-start gap-3 ${
              w.type === 'urgent'
                ? 'bg-sky-50/80 border-sky-200'
                : w.type === 'holiday_conflict'
                ? 'bg-amber-50/50 border-amber-200'
                : 'bg-white border-slate-200'
            }`}
          >
            {/* Subtle pulsing indicator for urgent items */}
            <div className="relative flex-shrink-0 mt-0.5">
              <Calendar className={`w-4 h-4 ${
                w.type === 'urgent' ? 'text-sky-600' : 'text-slate-500'
              }`} />
              {w.type === 'urgent' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-bold text-slate-800">
                {w.label} — חודש {w.reportMonth}
              </p>
              <p className="text-slate-600 mt-0.5">
                {w.daysUntil === 0 && 'היום · '}
                {w.daysUntil === 1 && 'מחר · '}
                {w.daysUntil > 1 && `עוד ${w.daysUntil} ימים · `}
                ({format(w.date, 'dd/MM', { locale: he })})
                {w.holiday && (
                  <span className="text-amber-700 font-semibold">
                    {' '} — נופל על {w.holiday.name}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
