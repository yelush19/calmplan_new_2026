import React, { useState, useEffect } from 'react';
import { format, differenceInCalendarDays, endOfMonth, getDay, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';

// Israeli tax reporting deadlines per month
// Each has: day of month, label, color scheme
const REPORTING_DEADLINES = [
  { day: 15, label: 'מע"מ + ביט"ל', color: 'slate' },
  { day: 19, label: 'ניכויים', color: 'gray' },
  { day: 23, label: 'מקדמות מ"ה', color: 'gray' },
];

function getWorkDaysUntil(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  if (target <= today) return 0;

  let count = 0;
  let current = addDays(today, 1);
  while (current <= target) {
    const day = getDay(current);
    // Sunday=0 is work day in Israel, Saturday=6 is not (Shabbat)
    if (day !== 6) count++;
    current = addDays(current, 1);
  }
  return count;
}

function getDeadlineStyle(calendarDays) {
  if (calendarDays <= 0) return 'bg-gray-100 text-gray-400 line-through';
  if (calendarDays <= 2) return 'bg-red-100 text-red-700 font-bold';
  if (calendarDays <= 5) return 'bg-amber-100 text-amber-700 font-semibold';
  return 'bg-gray-100 text-gray-600';
}

export default function TimeAwareness() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const dayOfWeek = format(now, 'EEEE', { locale: he });
  const dateStr = format(now, 'd בMMMM yyyy', { locale: he });
  const timeStr = format(now, 'HH:mm');

  const currentDay = now.getDate();
  const dayNum = getDay(now); // 0=Sun, 6=Sat
  const isShabbat = dayNum === 6;
  const daysLeftThisWeek = dayNum <= 5 ? 5 - dayNum : 0;

  // Build upcoming deadlines for this month
  const upcomingDeadlines = REPORTING_DEADLINES
    .map(d => {
      const deadlineDate = new Date(now.getFullYear(), now.getMonth(), d.day);
      const calendarDays = differenceInCalendarDays(deadlineDate, now);
      const workDays = calendarDays > 0 ? getWorkDaysUntil(deadlineDate) : 0;
      return { ...d, calendarDays, workDays, passed: calendarDays < 0 };
    })
    .filter(d => !d.passed); // Only show future or today deadlines

  // Find nearest urgent deadline
  const nearestDeadline = upcomingDeadlines[0];
  const isUrgent = nearestDeadline && nearestDeadline.calendarDays <= 2;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm border-b ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-gradient-to-l from-slate-50 to-white border-gray-200'}`}>
      {/* Date & Time */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-bold text-gray-800">{dayOfWeek}</span>
          <span className="text-gray-500">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-gray-600 tabular-nums">{timeStr}</span>
        </div>
        {daysLeftThisWeek > 0 && !isShabbat && (
          <span className="text-gray-500 text-xs hidden md:inline">
            <span className="font-semibold text-gray-700">{daysLeftThisWeek}</span> ימי עבודה עד שישי
          </span>
        )}
        {isShabbat && (
          <span className="text-purple-600 font-medium text-xs">שבת שלום</span>
        )}
      </div>

      {/* Reporting Deadlines */}
      <div className="flex items-center gap-2 text-xs">
        {upcomingDeadlines.length > 0 ? (
          upcomingDeadlines.map((d) => (
            <span
              key={d.day}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap ${getDeadlineStyle(d.calendarDays)}`}
            >
              {d.calendarDays <= 2 && <AlertTriangle className="w-3 h-3" />}
              {d.calendarDays === 0 ? (
                <span>היום! {d.label} (ה-{d.day})</span>
              ) : (
                <span>{d.workDays} ימ"ע {d.label} (ה-{d.day})</span>
              )}
            </span>
          ))
        ) : (
          <span className="text-gray-400 px-2 py-0.5 rounded-full bg-gray-50">
            {differenceInCalendarDays(endOfMonth(now), now)} ימים לסוף חודש - כל הדיווחים הוגשו
          </span>
        )}
      </div>
    </div>
  );
}
