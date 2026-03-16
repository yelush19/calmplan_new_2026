import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Calendar } from 'lucide-react';
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

/**
 * מחשב התראות על דדליינים קרובים בתוך 14 יום.
 * בודק גם אם דדליין נופל על חג/שבת.
 */
function computeWarnings(today) {
  const warnings = [];
  const todayStr = format(today, 'yyyy-MM-dd');

  // בדוק את החודש הנוכחי והבא
  for (let reportMonth = 1; reportMonth <= 12; reportMonth++) {
    const entry = TAX_CALENDAR_2026[reportMonth];
    if (!entry) continue;

    const deadlineFields = ['payroll', 'nationalInsurance', 'onlineFiling', 'detailedVat', 'masavSocial', 'masavAuthorities', 'masavSuppliers', 'operatorReport'];

    for (const field of deadlineFields) {
      const dateStr = entry[field];
      if (!dateStr) continue;

      const deadlineDate = new Date(dateStr);
      const daysUntil = differenceInCalendarDays(deadlineDate, today);

      // הצג התראות רק ל-14 יום קדימה
      if (daysUntil < 0 || daysUntil > 14) continue;

      const label = DEADLINE_LABELS[field] || field;
      const reportMonthName = HEBREW_MONTH_NAMES[reportMonth - 1];

      // בדוק אם נופל על חג
      const holiday = ISRAELI_HOLIDAYS_2026[dateStr];

      if (daysUntil <= 3) {
        // דדליין תוך 3 ימים — תמיד הצג
        warnings.push({
          date: deadlineDate,
          dateStr,
          label,
          reportMonth: reportMonthName,
          daysUntil,
          type: 'urgent',
          holiday: holiday || null,
        });
      } else if (holiday) {
        // דדליין נופל על חג — הצג גם אם יותר מ-3 ימים
        warnings.push({
          date: deadlineDate,
          dateStr,
          label,
          reportMonth: reportMonthName,
          daysUntil,
          type: 'holiday_conflict',
          holiday,
        });
      } else if (daysUntil <= 7) {
        // דדליין תוך שבוע — הצג
        warnings.push({
          date: deadlineDate,
          dateStr,
          label,
          reportMonth: reportMonthName,
          daysUntil,
          type: 'upcoming',
          holiday: null,
        });
      }
    }
  }

  // מיין לפי דחיפות
  warnings.sort((a, b) => a.daysUntil - b.daysUntil);
  return warnings;
}

export default function AdvanceWarningPanel() {
  const warnings = useMemo(() => computeWarnings(new Date()), []);

  if (warnings.length === 0) return null;

  return (
    <Card className="bg-yellow-50 border-yellow-200 border-2">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base text-yellow-800">
          <AlertTriangle className="w-5 h-5" />
          התראות דדליין
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3">
        {warnings.map((w, i) => (
          <div
            key={`${w.dateStr}-${w.label}`}
            className={`p-2.5 rounded-lg border flex items-start gap-3 ${
              w.type === 'urgent'
                ? 'bg-red-50 border-red-300'
                : w.type === 'holiday_conflict'
                ? 'bg-orange-50 border-orange-300'
                : 'bg-white border-yellow-300'
            }`}
          >
            <Calendar className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              w.type === 'urgent' ? 'text-red-600' : 'text-yellow-700'
            }`} />
            <div className="text-sm">
              <p className="font-bold text-gray-800">
                {w.label} — חודש {w.reportMonth}
              </p>
              <p className="text-gray-600 mt-0.5">
                {w.type === 'urgent' && w.daysUntil === 0 && '⚠️ היום! '}
                {w.type === 'urgent' && w.daysUntil === 1 && '⚠️ מחר! '}
                {w.type === 'urgent' && w.daysUntil > 1 && `⚠️ עוד ${w.daysUntil} ימים `}
                {w.type !== 'urgent' && `עוד ${w.daysUntil} ימים `}
                ({format(w.date, 'dd/MM', { locale: he })})
                {w.holiday && (
                  <span className="text-orange-700 font-semibold">
                    {' '} — נופל על {w.holiday.name}!
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
