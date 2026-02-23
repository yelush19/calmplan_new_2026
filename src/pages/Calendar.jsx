import React, { useState, useEffect, useMemo } from "react";
import { Event, Task } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft,
  CheckCircle, Target, Briefcase, Home, Star, Pin, ArrowLeft, ArrowRight,
  Loader, Eye, Search
} from "lucide-react";
import {
  format, parseISO, isValid, isBefore, isSameDay, startOfWeek, endOfWeek,
  addDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth,
  getDaysInMonth, getDay, isToday, isSameMonth, differenceInDays, startOfDay
} from "date-fns";
import { he } from "date-fns/locale";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import EventDetailsModal from "../components/calendar/EventDetailsModal";
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';

const DAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAYS_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const safeParseDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const contextConfig = {
  work: { label: 'עבודה', bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200', dot: 'bg-sky-500', icon: Briefcase },
  home: { label: 'בית', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: Home },
  personal: { label: 'אישי', bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', dot: 'bg-violet-500', icon: Star },
  event: { label: 'אירוע', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500', icon: CalendarIcon },
};

const priorityDots = {
  urgent: 'bg-amber-500',
  high: 'bg-amber-400',
  medium: 'bg-sky-400',
  low: 'bg-gray-300',
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week"); // default to week for ADHD
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteTask, setNoteTask] = useState(null);
  const location = useLocation();

  // Reload data on mount and when navigating back to this page
  useEffect(() => {
    loadData();
  }, [location.key]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, eventsData] = await Promise.all([
        Task.list("-created_date", 5000).catch(() => []),
        Event.list("-start_date", 1000).catch(() => []),
      ]);

      const allTasks = (tasksData || []).filter(t => {
        if (!t || t.status === 'completed' || t.status === 'not_relevant') return false;
        const dueDate = safeParseDateString(t.due_date);
        const scheduledStart = safeParseDateString(t.scheduled_start);
        return dueDate !== null || scheduledStart !== null;
      });

      const now = new Date();
      const validEvents = (eventsData || []).filter(event => {
        if (!event) return false;
        const startDate = safeParseDateString(event.start_date);
        if (!startDate) return false;
        const endDate = event.end_date ? safeParseDateString(event.end_date) : startDate;
        if (endDate && isBefore(endDate, now)) return false;
        return true;
      });

      setEvents(validEvents);
      setTasks(allTasks);
    } catch (error) {
      console.error("Error loading calendar data:", error);
      setEvents([]);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Combine all items
  const allItems = useMemo(() => {
    let items = [
      ...events.map(e => ({ ...e, itemType: 'event', _date: safeParseDateString(e.start_date) })),
      ...tasks.map(t => ({
        ...t,
        itemType: 'task',
        _date: safeParseDateString(t.due_date) || safeParseDateString(t.scheduled_start)
      }))
    ].filter(item => item._date);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(item =>
        item.title?.toLowerCase().includes(lower) ||
        item.client_name?.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower)
      );
    }

    return items;
  }, [events, tasks, searchTerm]);

  const getItemsForDate = (date) => {
    return allItems.filter(item => isSameDay(item._date, date));
  };

  const getItemContext = (item) => {
    if (item.itemType === 'event') return 'event';
    if (item.context === 'home') return 'home';
    if (item.context === 'work' || item.category?.startsWith('work_')) return 'work';
    return 'personal';
  };

  // Stats
  const today = new Date();
  const todayItems = getItemsForDate(today);
  const overdueTasks = tasks.filter(t => {
    const dueDate = safeParseDateString(t.due_date);
    return dueDate && isBefore(startOfDay(dueDate), startOfDay(today)) && t.status !== 'completed';
  });

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const thisWeekItems = allItems.filter(item =>
    item._date >= weekStart && item._date <= weekEnd
  );

  // Navigation
  const navigatePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setSelectedDate(addDays(selectedDate, -1));
  };

  const navigateNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleMoveToNote = (task) => {
    setNoteTask(task);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="mr-3 text-gray-500 text-lg">טוען לוח שנה...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Strip - ADHD friendly quick overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/80 cursor-pointer hover:shadow-md transition-shadow" onClick={goToToday}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{todayItems.length}</p>
              <p className="text-xs text-emerald-600">היום</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-sky-50/80">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-sky-700">{thisWeekItems.length}</p>
              <p className="text-xs text-sky-600">השבוע</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`${overdueTasks.length > 0 ? 'border-amber-200 bg-amber-50/80' : 'border-gray-200 bg-gray-50'}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${overdueTasks.length > 0 ? 'bg-amber-500' : 'bg-gray-400'} flex items-center justify-center`}>
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{overdueTasks.length}</p>
              <p className="text-xs text-gray-500">ממתינים</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Calendar Main Area */}
      <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="חיפוש לפי שם לקוח, אירוע, משימה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 h-9"
            />
          </div>

          {/* View Tabs + Navigation */}
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* View tabs */}
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  {[
                    { key: 'day', label: 'יומי' },
                    { key: 'week', label: 'שבועי' },
                    { key: 'month', label: 'חודשי' },
                  ].map(v => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        view === v.key
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={navigateNext} className="p-2">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-semibold"
                  >
                    היום
                  </Button>
                  <Button variant="ghost" size="sm" onClick={navigatePrev} className="p-2">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-base font-bold text-gray-700 mr-2">
                    {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: he })}
                    {view === 'week' && (
                      <>
                        {format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM', { locale: he })}
                        {' - '}
                        {format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM', { locale: he })}
                      </>
                    )}
                    {view === 'day' && format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Views */}
          <AnimatePresence mode="wait">
            {view === 'month' && (
              <MonthGrid
                key="month"
                currentDate={currentDate}
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); setView('day'); }}
                getItemsForDate={getItemsForDate}
                getItemContext={getItemContext}
              />
            )}
            {view === 'week' && (
              <WeekGrid
                key="week"
                currentDate={currentDate}
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); setView('day'); }}
                getItemsForDate={getItemsForDate}
                getItemContext={getItemContext}
                onItemClick={setSelectedItem}
                onMoveToNote={handleMoveToNote}
              />
            )}
            {view === 'day' && (
              <DayDetail
                key="day"
                date={selectedDate}
                items={getItemsForDate(selectedDate)}
                getItemContext={getItemContext}
                onItemClick={setSelectedItem}
                onMoveToNote={handleMoveToNote}
              />
            )}
          </AnimatePresence>
      </div>

      {/* Add Event FAB */}
      <Link to={createPageUrl("NewEvent")}>
        <Button
          size="lg"
          className="fixed bottom-8 left-20 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-2xl z-50 transition-all duration-300 hover:scale-110"
        >
          <Plus className="w-7 h-7 text-white" />
        </Button>
      </Link>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <EventDetailsModal
            item={selectedItem}
            itemType={selectedItem.itemType}
            onClose={() => setSelectedItem(null)}
            onSave={() => { setSelectedItem(null); loadData(); }}
          />
        )}
      </AnimatePresence>

      <TaskToNoteDialog
        task={noteTask}
        open={!!noteTask}
        onClose={() => setNoteTask(null)}
      />
    </div>
  );
}

// ========================================
// MONTH VIEW
// ========================================
function MonthGrid({ currentDate, selectedDate, onSelectDate, getItemsForDate, getItemContext }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
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

  const rowCount = weeks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="shadow-sm overflow-hidden backdrop-blur-xl bg-white/45 border-white/20 rounded-[32px]">
        <CardContent className="p-0" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/20 shrink-0">
            {DAYS_HE.map((d, i) => (
              <div key={i} className="p-2 text-center text-xs font-semibold text-[#008291] bg-white/30">
                {d}
              </div>
            ))}
          </div>
          {/* Weeks — fixed height grid, no scroll */}
          <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${rowCount}, 1fr)` }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-white/10 last:border-b-0 min-h-0">
                {week.map((d, di) => {
                  const items = getItemsForDate(d);
                  const inMonth = isSameMonth(d, currentDate);
                  const isSelected = isSameDay(d, selectedDate);
                  const isTodayDate = isToday(d);
                  const MAX_DOTS = 4;

                  return (
                    <button
                      key={di}
                      onClick={() => onSelectDate(d)}
                      className={`relative p-1.5 border-l border-white/10 first:border-l-0 text-right transition-colors overflow-hidden rounded-lg m-0.5 ${
                        !inMonth ? 'bg-white/10 opacity-40' :
                        isSelected ? 'bg-emerald-100/50 backdrop-blur-sm' :
                        isTodayDate ? 'bg-amber-50/50 backdrop-blur-sm' :
                        'bg-white/20 hover:bg-white/40 backdrop-blur-sm'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${
                        isTodayDate ? 'w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs' :
                        isSelected ? 'text-emerald-600' :
                        'text-gray-700'
                      }`}>
                        {format(d, 'd')}
                      </span>
                      {/* Item dots */}
                      {items.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {items.slice(0, MAX_DOTS).map((item, idx) => {
                            const ctx = getItemContext(item);
                            const config = contextConfig[ctx] || contextConfig.personal;
                            return (
                              <div key={idx} className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            );
                          })}
                          {items.length > MAX_DOTS && (
                            <span className="text-[9px] text-gray-400 leading-none">+{items.length - MAX_DOTS}</span>
                          )}
                        </div>
                      )}
                      {/* Capacity indicator for work days */}
                      {inMonth && items.length >= 5 && (
                        <div className="absolute bottom-0.5 left-0.5 right-0.5">
                          <div className="h-0.5 bg-amber-400 rounded-full" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// WEEK VIEW — compact 7-column CSS grid (like month, but with item pills)
// ========================================
function WeekGrid({ currentDate, selectedDate, onSelectDate, getItemsForDate, getItemContext, onItemClick, onMoveToNote }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const MAX_VISIBLE = 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="shadow-sm overflow-hidden backdrop-blur-xl bg-white/45 border-white/20 rounded-[32px]">
        <CardContent className="p-0" style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="border-b border-white/20 shrink-0">
            {DAYS_HE.map((d, i) => (
              <div key={i} className="p-2 text-center text-xs font-semibold text-[#008291] bg-white/30">
                {d}
              </div>
            ))}
          </div>
          {/* 7 day columns */}
          <div className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, idx) => {
              const items = getItemsForDate(day);
              const isTodayDate = isToday(day);
              const isWeekend = idx >= 5;

              return (
                <button
                  key={idx}
                  onClick={() => onSelectDate(day)}
                  className={`flex flex-col p-1.5 border-l border-white/10 first:border-l-0 transition-colors overflow-hidden ${
                    isTodayDate ? 'bg-emerald-100/50 backdrop-blur-sm' :
                    isWeekend ? 'bg-white/10 opacity-60' :
                    'bg-white/20 hover:bg-white/40 backdrop-blur-sm'
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-bold ${
                      isTodayDate ? 'w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs' :
                      'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[9px] text-gray-400 font-medium">{items.length}</span>
                    )}
                  </div>
                  {/* Item pills */}
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {items.slice(0, MAX_VISIBLE).map((item) => {
                      const ctx = getItemContext(item);
                      const config = contextConfig[ctx] || contextConfig.personal;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${config.bg} ${config.text} cursor-pointer`}
                          onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                          <span className="truncate">{item.title}</span>
                        </div>
                      );
                    })}
                    {items.length > MAX_VISIBLE && (
                      <span className="text-[9px] text-gray-400 block text-center">+{items.length - MAX_VISIBLE}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// DAY VIEW — Vertical Time Grid (00:00 – 23:00)
// ========================================
function DayDetail({ date, items, getItemContext, onItemClick, onMoveToNote }) {
  const isTodayDate = isToday(date);
  const HOUR_HEIGHT = 56; // px per hour row
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Parse time from an item: returns hour (0-23) or null
  const getItemHour = (item) => {
    // Try due_time first (HH:mm)
    if (item.due_time) {
      const h = parseInt(item.due_time.split(':')[0], 10);
      if (!isNaN(h) && h >= 0 && h <= 23) return h;
    }
    // Try start_date / scheduled_start (ISO with time)
    const dateStr = item.start_date || item.scheduled_start;
    if (dateStr) {
      const parsed = safeParseDateString(dateStr);
      if (parsed) {
        const h = parsed.getHours();
        // Only use if time component is non-midnight (to avoid false positives from date-only values)
        if (h !== 0 || parsed.getMinutes() !== 0) return h;
      }
    }
    return null;
  };

  // Split items: timed vs all-day
  const timedItems = [];
  const allDayItems = [];
  items.forEach(item => {
    const hour = getItemHour(item);
    if (hour !== null) {
      timedItems.push({ ...item, _hour: hour });
    } else {
      allDayItems.push(item);
    }
  });

  // Now indicator
  const nowHour = new Date().getHours();
  const nowMinute = new Date().getMinutes();
  const nowOffset = isTodayDate ? (nowHour * HOUR_HEIGHT + (nowMinute / 60) * HOUR_HEIGHT) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {/* Day header */}
      <Card className={`shadow-sm backdrop-blur-xl bg-white/45 border-white/20 rounded-[32px] ${isTodayDate ? 'ring-1 ring-emerald-200' : ''}`}>
        <CardContent className="p-4 text-center">
          <h2 className="text-xl font-bold text-gray-800">
            {format(date, 'EEEE', { locale: he })}
          </h2>
          <p className="text-sm text-gray-500">
            {format(date, 'd בMMMM yyyy', { locale: he })}
          </p>
          <div className="flex justify-center gap-2 mt-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{items.length} פריטים</Badge>
            {allDayItems.length > 0 && <Badge className="bg-violet-100 text-violet-700 border-violet-200">{allDayItems.length} כל היום</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* All-day items */}
      {allDayItems.length > 0 && (
        <Card className="shadow-sm backdrop-blur-xl bg-white/45 border-white/20 rounded-[24px]">
          <CardContent className="p-3">
            <p className="text-xs font-bold text-[#008291] mb-2">כל היום</p>
            <div className="space-y-1.5">
              {allDayItems.map(item => {
                const ctx = getItemContext(item);
                const config = contextConfig[ctx] || contextConfig.personal;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl ${config.bg} ${config.text} cursor-pointer hover:shadow-sm transition-all group`}
                    onClick={() => onItemClick(item)}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                    <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
                    {item.client_name && <span className="text-[10px] text-gray-400">{item.client_name}</span>}
                    {item.itemType === 'task' && (
                      <button onClick={(e) => { e.stopPropagation(); onMoveToNote(item); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/50"><Pin className="w-3 h-3 text-amber-600" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time grid */}
      <Card className="shadow-sm backdrop-blur-xl bg-white/45 border-white/20 rounded-[24px] overflow-hidden">
        <CardContent className="p-0">
          <div className="relative overflow-y-auto" style={{ height: 'calc(100vh - 380px)' }}>
            {/* Hour rows */}
            {HOURS.map(h => (
              <div
                key={h}
                className="flex border-b border-white/15"
                style={{ height: HOUR_HEIGHT }}
              >
                <div className="w-14 shrink-0 text-[10px] font-semibold text-[#008291]/60 text-center pt-1 border-l border-white/15">
                  {String(h).padStart(2, '0')}:00
                </div>
                <div className="flex-1 relative">
                  {/* Timed items in this hour */}
                  {timedItems.filter(item => item._hour === h).map(item => {
                    const ctx = getItemContext(item);
                    const config = contextConfig[ctx] || contextConfig.personal;
                    return (
                      <div
                        key={item.id}
                        className={`absolute inset-x-1 top-1 bottom-1 flex items-center gap-2 px-3 rounded-xl ${config.bg} ${config.text} cursor-pointer hover:shadow-md transition-all group border ${config.border}`}
                        onClick={() => onItemClick(item)}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                        <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
                        {item.client_name && <span className="text-[10px] text-gray-400 hidden md:inline">{item.client_name}</span>}
                        {item.itemType === 'task' && (
                          <button onClick={(e) => { e.stopPropagation(); onMoveToNote(item); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/50"><Pin className="w-3 h-3 text-amber-600" /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Now indicator */}
            {nowOffset !== null && (
              <div
                className="absolute left-14 right-0 h-0.5 bg-emerald-500 z-10 pointer-events-none"
                style={{ top: nowOffset }}
              >
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-emerald-500" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card className="shadow-sm backdrop-blur-xl bg-white/45 border-white/20 rounded-[24px]">
          <CardContent className="p-8 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-lg text-gray-400">יום פנוי</p>
            <Link to={createPageUrl("NewEvent")} className="inline-block mt-4">
              <Button variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                <Plus className="w-4 h-4 ml-1" />
                הוסף אירוע
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
