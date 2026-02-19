import React, { useState, useEffect, useRef } from 'react';
import { format, differenceInCalendarDays, endOfMonth, getDay, addDays, startOfMonth, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Calendar, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Task } from '@/api/entities';

// Map each reporting deadline to the task categories it covers
const REPORTING_DEADLINES = [
  { day: 15, label: 'ביטוח לאומי', color: 'slate', categories: ['ביטוח לאומי', 'שכר'] },
  { day: 19, label: 'מע"מ / ניכויים / מקדמות', color: 'gray', categories: ['מע"מ', 'ניכויים', 'מקדמות מס'] },
  { day: 23, label: '874 מפורט', color: 'gray', categories: ['מע"מ 874'] },
];

// Statuses that mean the report has been filed / is done
const DONE_STATUSES = new Set(['completed', 'not_relevant', 'reported_waiting_for_payment']);

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
    if (day !== 6) count++;
    current = addDays(current, 1);
  }
  return count;
}

function getDeadlineStyle(calendarDays, hasIncomplete) {
  if (calendarDays < 0) return 'bg-gray-200 text-gray-400 line-through';
  if (calendarDays === 0) {
    // Today is the deadline day
    if (hasIncomplete) return 'bg-red-200 text-red-800 font-bold ring-2 ring-red-300';
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

      <div className="flex gap-2 mt-2 text-[10px] text-gray-400 justify-center">
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
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tasks and compute incomplete counts per deadline
  useEffect(() => {
    let cancelled = false;
    async function fetchDeadlineTasks() {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        if (cancelled) return;

        const counts = {};
        for (const dl of REPORTING_DEADLINES) {
          const matching = allTasks.filter(t =>
            t && t.category && dl.categories.includes(t.category)
          );
          const incomplete = matching.filter(t => !DONE_STATUSES.has(t.status));
          counts[dl.day] = { total: matching.length, incomplete: incomplete.length };
        }
        setDeadlineTasks(counts);
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

  const upcomingDeadlines = REPORTING_DEADLINES
    .map(d => {
      const deadlineDate = new Date(now.getFullYear(), now.getMonth(), d.day);
      const calendarDays = differenceInCalendarDays(deadlineDate, now);
      const workDays = calendarDays > 0 ? getWorkDaysUntil(deadlineDate) : 0;
      const taskInfo = deadlineTasks[d.day] || { total: 0, incomplete: 0 };
      return { ...d, calendarDays, workDays, passed: calendarDays < 0, ...taskInfo };
    })
    .filter(d => !d.passed);

  const nearestDeadline = upcomingDeadlines[0];
  const isUrgent = nearestDeadline && nearestDeadline.calendarDays <= 2;
  const hasTodayIncomplete = upcomingDeadlines.some(d => d.calendarDays === 0 && d.incomplete > 0);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 shadow-sm ${
      hasTodayIncomplete ? 'bg-red-50 border-2 border-red-300' :
      isUrgent ? 'bg-amber-50 border-2 border-amber-200' :
      'bg-white border border-gray-200'
    }`}>
      {/* Date & Time - bigger text */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors cursor-pointer"
        >
          <Calendar className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-lg text-gray-900">{dayOfWeek}</span>
          <span className="text-base text-gray-600">{dateStr}</span>
        </button>

        {showCalendar && <MiniCalendar now={now} onClose={() => setShowCalendar(false)} />}

        <div className="flex items-center gap-1.5 border-r border-gray-300 pr-4">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-lg font-semibold text-gray-700 tabular-nums">{timeStr}</span>
        </div>

        {daysLeftThisWeek > 0 && !isShabbat && (
          <span className="text-sm text-gray-600">
            <span className="font-bold text-gray-800">{daysLeftThisWeek}</span> ימי עבודה עד שישי
          </span>
        )}
        {isShabbat && (
          <span className="text-purple-600 font-bold text-sm">שבת שלום</span>
        )}
      </div>

      {/* Reporting Deadlines - bigger badges */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          {upcomingDeadlines.length > 0 ? (
            upcomingDeadlines.map((d) => {
              const hasIncomplete = d.incomplete > 0;
              return (
                <span
                  key={d.day}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-sm ${getDeadlineStyle(d.calendarDays, hasIncomplete)}`}
                >
                  {d.calendarDays === 0 && hasIncomplete && <AlertTriangle className="w-4 h-4" />}
                  {d.calendarDays <= 2 && !(d.calendarDays === 0 && hasIncomplete) && <Clock className="w-4 h-4" />}
                  {d.calendarDays === 0 ? (
                    <span>היום! {d.label} (ה-{d.day})</span>
                  ) : (
                    <span>{d.workDays} ימ"ע {d.label} (ה-{d.day})</span>
                  )}
                  {d.calendarDays === 0 && d.total > 0 && (
                    <span className={`mr-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                      hasIncomplete ? 'bg-red-300 text-red-900' : 'bg-emerald-300 text-emerald-900'
                    }`}>
                      {d.total - d.incomplete}/{d.total}
                    </span>
                  )}
                </span>
              );
            })
          ) : (
            <span className="text-sm text-gray-500 px-3 py-1.5 rounded-lg bg-emerald-50">
              {differenceInCalendarDays(endOfMonth(now), now)} ימים לסוף חודש - כל הדיווחים הוגשו
            </span>
          )}
        </div>

        {/* Warning banner for today's incomplete reports */}
        {upcomingDeadlines.filter(d => d.calendarDays === 0 && d.incomplete > 0).map(d => (
          <div key={`warn-${d.day}`} className="flex items-center gap-2 bg-red-100 border border-red-300 rounded-lg px-3 py-1.5 text-sm text-red-800 font-semibold animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {d.label}: {d.incomplete} דיווחים לא הושלמו מתוך {d.total} — היום יום אחרון!
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
