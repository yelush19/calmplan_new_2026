import React, { useState, useEffect } from 'react';
import { format, differenceInCalendarDays, endOfMonth, getDay, addDays, isWeekend } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';

function getWorkDaysUntil(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  let count = 0;
  let current = addDays(today, 1);
  while (current <= target) {
    const day = getDay(current);
    // Sunday=0 is work day in Israel, Saturday=6 is not (Shabbat)
    // Friday=5 is half day but counts
    if (day !== 6) count++;
    current = addDays(current, 1);
  }
  return count;
}

export default function TimeAwareness() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const dayOfWeek = format(now, 'EEEE', { locale: he });
  const dateStr = format(now, 'd בMMMM yyyy', { locale: he });
  const timeStr = format(now, 'HH:mm');

  // Reporting deadline: 15th of current month for previous month's report
  const currentDay = now.getDate();
  const reportingDeadline = new Date(now.getFullYear(), now.getMonth(), 15);
  const daysToReporting = currentDay <= 15
    ? differenceInCalendarDays(reportingDeadline, now)
    : null; // Already passed this month

  // End of month deadline (for some reports)
  const monthEnd = endOfMonth(now);
  const daysToMonthEnd = differenceInCalendarDays(monthEnd, now);

  // Work days left this week (until Friday inclusive)
  const dayNum = getDay(now); // 0=Sun, 6=Sat
  const daysLeftThisWeek = dayNum <= 5 ? 5 - dayNum : 0; // Days until Friday

  // Work days until 15th
  const workDaysToReporting = daysToReporting !== null ? getWorkDaysUntil(reportingDeadline) : null;

  const isUrgent = daysToReporting !== null && daysToReporting <= 3;
  const isShabbat = dayNum === 6;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm border-b ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-gradient-to-l from-slate-50 to-white border-gray-200'}`}>
      {/* Left: Date & Time */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-bold text-gray-800">{dayOfWeek}</span>
          <span className="text-gray-500">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-gray-600 tabular-nums">{timeStr}</span>
        </div>
      </div>

      {/* Right: Countdowns */}
      <div className="flex items-center gap-4 text-xs">
        {daysLeftThisWeek > 0 && !isShabbat && (
          <span className="text-gray-500">
            <span className="font-semibold text-gray-700">{daysLeftThisWeek}</span> ימי עבודה עד שישי
          </span>
        )}
        {isShabbat && (
          <span className="text-purple-600 font-medium">שבת שלום</span>
        )}
        {daysToReporting !== null && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
            isUrgent
              ? 'bg-red-100 text-red-700'
              : daysToReporting <= 7
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
          }`}>
            {isUrgent && <AlertTriangle className="w-3 h-3" />}
            {workDaysToReporting} ימי עבודה לדיווח (ה-15)
          </span>
        )}
        {daysToReporting === null && (
          <span className="text-gray-400 px-2 py-0.5 rounded-full bg-gray-50">
            {daysToMonthEnd} ימים לסוף חודש
          </span>
        )}
      </div>
    </div>
  );
}
