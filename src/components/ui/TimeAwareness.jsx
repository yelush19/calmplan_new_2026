import React, { useState, useEffect, useRef } from 'react';
import { format, differenceInCalendarDays, endOfMonth, getDay, addDays, startOfMonth, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Calendar, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const REPORTING_DEADLINES = [
  { day: 15, label: 'ביטוח לאומי', color: 'slate' },
  { day: 19, label: 'מע"מ / ניכויים / מקדמות', color: 'gray' },
  { day: 23, label: '874 מפורט', color: 'gray' },
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
    if (day !== 6) count++;
    current = addDays(current, 1);
  }
  return count;
}

function getDeadlineStyle(calendarDays) {
  if (calendarDays <= 0) return 'bg-gray-200 text-gray-400 line-through';
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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
      return { ...d, calendarDays, workDays, passed: calendarDays < 0 };
    })
    .filter(d => !d.passed);

  const nearestDeadline = upcomingDeadlines[0];
  const isUrgent = nearestDeadline && nearestDeadline.calendarDays <= 2;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 shadow-sm ${isUrgent ? 'bg-amber-50 border-2 border-amber-200' : 'bg-white border border-gray-200'}`}>
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
      <div className="flex items-center gap-2">
        {upcomingDeadlines.length > 0 ? (
          upcomingDeadlines.map((d) => (
            <span
              key={d.day}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-sm ${getDeadlineStyle(d.calendarDays)}`}
            >
              {d.calendarDays <= 2 && <Clock className="w-4 h-4" />}
              {d.calendarDays === 0 ? (
                <span>היום! {d.label} (ה-{d.day})</span>
              ) : (
                <span>{d.workDays} ימ"ע {d.label} (ה-{d.day})</span>
              )}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500 px-3 py-1.5 rounded-lg bg-emerald-50">
            {differenceInCalendarDays(endOfMonth(now), now)} ימים לסוף חודש - כל הדיווחים הוגשו
          </span>
        )}
      </div>
    </div>
  );
}
