import React, { useState, useEffect, useRef } from 'react';
import { format, differenceInCalendarDays, endOfMonth, getDay, addDays, startOfMonth, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Calendar, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Task } from '@/api/entities';

// Map each reporting deadline to the task categories it covers (Hebrew + English work categories)
const REPORTING_DEADLINES = [
  { day: 9,  label: 'שכר - מס"ב ותלושים', color: 'slate', categories: ['שכר', 'work_payroll'] },
  { day: 15, label: 'פנסיות וקרנות + ביטוח לאומי דיווח', color: 'slate', categories: ['ביטוח לאומי', 'work_social_security'] },
  { day: 19, label: 'מע"מ / ניכויים / מקדמות', color: 'gray', categories: ['מע"מ', 'work_vat_reporting', 'ניכויים', 'work_deductions', 'מקדמות מס', 'work_tax_advances'] },
  { day: 23, label: '874 מפורט', color: 'gray', categories: ['מע"מ 874', 'work_vat_874'] },
];

// Statuses that mean the report has been filed / is done
const DONE_STATUSES = new Set(['completed', 'not_relevant', 'reported_waiting_for_payment', 'production_completed']);

// Israeli holidays 2026 — non-work days (imported from LifeSettings calendar)
const HOLIDAY_DATES_2026 = new Set([
  '2026-03-03','2026-03-04','2026-03-05', // פורים
  '2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05','2026-04-06','2026-04-07','2026-04-08', // פסח מלא (ערב + חג + חול המועד + שביעי)
  '2026-04-21','2026-04-22', // יום הזיכרון + עצמאות
  '2026-05-05', // ל"ג בעומר
  '2026-05-21','2026-05-22', // שבועות
  '2026-07-23','2026-07-24', // ט' באב
  '2026-09-11','2026-09-12','2026-09-13', // ראש השנה
  '2026-09-20','2026-09-21', // יום כיפור
  '2026-09-25','2026-09-26','2026-09-27','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03', // סוכות מלא (ערב + חג + חול המועד + שמחת תורה)
]);

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
    const dateStr = format(current, 'yyyy-MM-dd');
    // Exclude: Friday (5), Saturday (6), and holidays
    if (day !== 5 && day !== 6 && !HOLIDAY_DATES_2026.has(dateStr)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

function getDeadlineStyle(calendarDays, hasIncomplete) {
  if (calendarDays < 0) return 'bg-gray-200 text-gray-400 line-through';
  if (calendarDays === 0) {
    // Today is the deadline day
    if (hasIncomplete) return 'bg-amber-200 text-amber-800 font-bold ring-2 ring-purple-300';
    return 'bg-emerald-200 text-emerald-800 font-bold';
  }
  if (calendarDays <= 2) return 'bg-amber-200 text-amber-800 font-bold';
  if (calendarDays <= 5) return 'bg-amber-100 text-amber-700 font-semibold';
  return 'bg-emerald-100 text-emerald-700 font-semibold';
}

function MiniCalendar({ now, onClose }) {
  const [viewMonth, setViewMonth] = useState(now);
  const calRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks = [];
  let day = calStart;
  while (day <= calEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  const deadlineDays = REPORTING_DEADLINES.map(d => d.day);

  return (
    <div ref={calRef} className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="font-bold text-gray-800">
          {format(viewMonth, 'MMMM yyyy', { locale: he })}
        </span>
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <table className="w-full text-center text-sm">
        <thead>
          <tr>
            {dayNames.map(d => (
              <th key={d} className="py-1 text-xs text-gray-500 font-medium">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                const isToday = isSameDay(d, now);
                const inMonth = isSameMonth(d, viewMonth);
                const isDeadline = inMonth && deadlineDays.includes(d.getDate());
                const isShabbat = getDay(d) === 6;
                return (
                  <td key={di} className="py-0.5">
                    <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs
                      ${isToday ? 'bg-emerald-500 text-white font-bold' : ''}
                      ${!isToday && isDeadline ? 'bg-amber-100 text-amber-700 font-bold ring-1 ring-amber-300' : ''}
                      ${!isToday && !isDeadline && inMonth ? 'text-gray-700' : ''}
                      ${!inMonth ? 'text-gray-300' : ''}
                      ${isShabbat && inMonth && !isToday ? 'text-gray-400' : ''}
                    `}>
                      {d.getDate()}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          to={createPageUrl('Calendar')}
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          פתח לוח שנה מלא
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-2 mt-2 text-[12px] text-gray-400 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> היום</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-200 ring-1 ring-amber-300 inline-block" /> דדליין</span>
      </div>
    </div>
  );
}

export default function TimeAwareness() {
  const [now, setNow] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [deadlineTasks, setDeadlineTasks] = useState({});  // { deadlineDay: { total, incomplete } }

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000); // Refresh every 30 seconds (was 60s)
    // Also refresh when tab becomes visible (user completed tasks in another view)
    const onVisibility = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  // Fetch tasks and compute incomplete counts per deadline (current + next month)
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [dueSoonTasks, setDueSoonTasks] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchDeadlineTasks() {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        if (cancelled) return;

        // Count tasks due in current month or next month
        const currentMonthPrefix = format(now, 'yyyy-MM');
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthPrefix = format(nextMonth, 'yyyy-MM');

        const counts = {};
        for (const dl of REPORTING_DEADLINES) {
          const matching = allTasks.filter(t => {
            if (!t || !t.category) return false;
            if (!dl.categories.includes(t.category)) return false;
            // Tasks due this month or next month
            if (!t.due_date) return false;
            if (!t.due_date.startsWith(currentMonthPrefix) && !t.due_date.startsWith(nextMonthPrefix)) return false;
            return true;
          });
          const incomplete = matching.filter(t => !DONE_STATUSES.has(t.status));
          counts[dl.day] = { total: matching.length, incomplete: incomplete.length };
        }
        setDeadlineTasks(counts);

        // Count ALL open work tasks (for banner when no deadlines this month)
        const openWork = allTasks.filter(t =>
          t && t.status && !DONE_STATUSES.has(t.status) &&
          t.context !== 'archived' && t.status !== 'not_relevant'
        );
        if (!cancelled) setOpenTaskCount(openWork.length);

        // Find tasks due TODAY or TOMORROW (any category) for urgent banner
        const todayStr = format(now, 'yyyy-MM-dd');
        const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');
        const dueSoon = openWork.filter(t => t.due_date === todayStr || t.due_date === tomorrowStr);
        if (!cancelled) setDueSoonTasks(dueSoon);
      } catch {
        // ignore
      }
    }
    fetchDeadlineTasks();
    return () => { cancelled = true; };
  }, [now]);

  const dayOfWeek = format(now, 'EEEE', { locale: he });
  const dateStr = format(now, 'd בMMMM yyyy', { locale: he });
  const timeStr = format(now, 'HH:mm');

  const dayNum = getDay(now);
  const isShabbat = dayNum === 6;
  const daysLeftThisWeek = dayNum <= 5 ? 5 - dayNum : 0;

  // Build upcoming deadlines — check current month AND next month
  const upcomingDeadlines = (() => {
    const thisMonth = REPORTING_DEADLINES
      .map(d => {
        const deadlineDate = new Date(now.getFullYear(), now.getMonth(), d.day);
        const calendarDays = differenceInCalendarDays(deadlineDate, now);
        const workDays = calendarDays > 0 ? getWorkDaysUntil(deadlineDate) : 0;
        const taskInfo = deadlineTasks[d.day] || { total: 0, incomplete: 0 };
        return { ...d, calendarDays, workDays, passed: calendarDays < 0, ...taskInfo };
      })
      .filter(d => !d.passed);

    // If no deadlines left this month, also check next month
    if (thisMonth.length === 0) {
      const nextMonthDeadlines = REPORTING_DEADLINES.map(d => {
        const deadlineDate = new Date(now.getFullYear(), now.getMonth() + 1, d.day);
        const calendarDays = differenceInCalendarDays(deadlineDate, now);
        const workDays = calendarDays > 0 ? getWorkDaysUntil(deadlineDate) : 0;
        return { ...d, calendarDays, workDays, passed: false, total: 0, incomplete: 0, nextMonth: true };
      });
      return nextMonthDeadlines.filter(d => d.calendarDays <= 14); // show next 14 days only
    }
    return thisMonth;
  })();

  const nearestDeadline = upcomingDeadlines[0];
  const isUrgent = nearestDeadline && nearestDeadline.calendarDays <= 2;
  const hasTodayIncomplete = upcomingDeadlines.some(d => d.calendarDays === 0 && d.incomplete > 0);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg mb-1.5 shadow-sm ${
      hasTodayIncomplete ? 'bg-amber-50 border-2 border-amber-300' :
      isUrgent ? 'bg-amber-50 border-2 border-amber-200' :
      'bg-white border border-gray-200'
    }`}>
      {/* Date & Time — compact */}
      <div className="flex items-center gap-3 relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex items-center gap-1.5 hover:bg-gray-50 rounded-md px-1.5 py-0.5 transition-colors cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-sm text-gray-900">{dayOfWeek}</span>
          <span className="text-xs text-gray-600">{dateStr}</span>
        </button>

        {showCalendar && <MiniCalendar now={now} onClose={() => setShowCalendar(false)} />}

        <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-sm font-semibold text-gray-700 tabular-nums">{timeStr}</span>
        </div>

        {daysLeftThisWeek > 0 && !isShabbat && (
          <span className="text-xs text-gray-600">
            <span className="font-bold text-gray-800">{daysLeftThisWeek}</span> ימי עבודה עד שישי
          </span>
        )}
        {isShabbat && (
          <span className="text-purple-600 font-bold text-xs">שבת שלום</span>
        )}
      </div>

      {/* Reporting Deadlines — compact badges */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {upcomingDeadlines.length > 0 ? (
            upcomingDeadlines.map((d) => {
              const hasIncomplete = d.incomplete > 0;
              return (
                <span
                  key={d.day}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md whitespace-nowrap text-xs ${getDeadlineStyle(d.calendarDays, hasIncomplete)}`}
                >
                  {d.calendarDays === 0 && hasIncomplete && <AlertTriangle className="w-3 h-3" />}
                  {d.calendarDays <= 2 && !(d.calendarDays === 0 && hasIncomplete) && <Clock className="w-3 h-3" />}
                  {d.calendarDays === 0 ? (
                    <span>היום! {d.label} (ה-{d.day})</span>
                  ) : d.calendarDays === 1 ? (
                    <span>מחר! {d.label} (ה-{d.day}){d.nextMonth ? ' (חודש הבא)' : ''}</span>
                  ) : (
                    <span>{d.workDays} ימ"ע {d.label} (ה-{d.day}){d.nextMonth ? ' (חודש הבא)' : ''}</span>
                  )}
                  {d.calendarDays === 0 && d.total > 0 && (
                    <span className={`mr-0.5 px-1 py-0 rounded text-[12px] font-bold ${
                      hasIncomplete ? 'bg-amber-300 text-amber-900' : 'bg-emerald-300 text-emerald-900'
                    }`}>
                      {d.total - d.incomplete}/{d.total}
                    </span>
                  )}
                </span>
              );
            })
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-md ${openTaskCount > 0 ? 'bg-amber-50 text-amber-700 font-semibold' : 'bg-gray-50 text-gray-500'}`}>
              {differenceInCalendarDays(endOfMonth(now), now)} ימים לסוף חודש — {openTaskCount} משימות פתוחות
            </span>
          )}
        </div>

        {/* Warning banner for today's incomplete reports */}
        {upcomingDeadlines.filter(d => d.calendarDays === 0 && d.incomplete > 0).map(d => (
          <div key={`warn-${d.day}`} className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 rounded-md px-2 py-1 text-xs text-amber-800 font-semibold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {d.label}: {d.incomplete} דיווחים לא הושלמו מתוך {d.total} — היום יום אחרון!
            </span>
          </div>
        ))}

        {/* Tasks due today/tomorrow that aren't in the static deadline list */}
        {dueSoonTasks.length > 0 && (() => {
          const todayStr = format(now, 'yyyy-MM-dd');
          const dueToday = dueSoonTasks.filter(t => t.due_date === todayStr);
          const dueTomorrow = dueSoonTasks.filter(t => t.due_date !== todayStr);
          return (
            <div className="flex flex-wrap items-center gap-2">
              {dueToday.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                  {dueToday.length} משימות לסיום היום
                </span>
              )}
              {dueTomorrow.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">
                  {dueTomorrow.length} משימות דד-ליין מחר
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
