import React, { useState, useEffect, useMemo } from "react";
import { Event, Task, StickyNote } from "@/api/entities";
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
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import EventDetailsModal from "../components/calendar/EventDetailsModal";
import StickyNotes from "@/components/StickyNotes";
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
  const [showStickyPanel, setShowStickyPanel] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteTask, setNoteTask] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, eventsData] = await Promise.all([
        Task.list("-created_date", 5000).catch(() => []),
        Event.list("-start_date", 1000).catch(() => []),
      ]);

      const allTasks = (tasksData || []).filter(t => {
        if (!t || t.status === 'completed') return false;
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

        <Card className="border-violet-200 bg-violet-50/80 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowStickyPanel(!showStickyPanel)}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
              <Pin className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-violet-700">פתקים</p>
              <p className="text-xs text-violet-500">{showStickyPanel ? 'הסתר' : 'הצג'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout: Calendar + Sticky Notes Panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar Main Area */}
        <div className="flex-1 space-y-4">
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

        {/* Sticky Notes Side Panel */}
        <AnimatePresence>
          {showStickyPanel && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="w-full lg:w-72 flex-shrink-0"
            >
              <Card className="shadow-sm border-amber-200/50 sticky top-4">
                <CardContent className="p-3">
                  <StickyNotes compact={false} />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Event FAB */}
      <Link to={createPageUrl("NewEvent")}>
        <Button
          size="lg"
          className="fixed bottom-8 left-8 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-2xl z-50 transition-all duration-300 hover:scale-110"
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_HE.map((d, i) => (
              <div key={i} className="p-2 text-center text-xs font-semibold text-gray-500 bg-gray-50">
                {d}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
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
                    className={`relative min-h-[70px] md:min-h-[90px] p-1.5 border-l border-gray-50 first:border-l-0 text-right transition-colors ${
                      !inMonth ? 'bg-gray-50/50 opacity-40' :
                      isSelected ? 'bg-emerald-50' :
                      isTodayDate ? 'bg-amber-50/50' :
                      'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${
                      isTodayDate ? 'w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center' :
                      isSelected ? 'text-emerald-600' :
                      'text-gray-700'
                    }`}>
                      {format(d, 'd')}
                    </span>
                    {/* Item dots */}
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {items.slice(0, MAX_DOTS).map((item, idx) => {
                          const ctx = getItemContext(item);
                          const config = contextConfig[ctx] || contextConfig.personal;
                          return (
                            <div key={idx} className={`w-2 h-2 rounded-full ${config.dot}`} />
                          );
                        })}
                        {items.length > MAX_DOTS && (
                          <span className="text-[10px] text-gray-400 leading-none">+{items.length - MAX_DOTS}</span>
                        )}
                      </div>
                    )}
                    {/* Capacity indicator for work days */}
                    {inMonth && items.length >= 5 && (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="h-0.5 bg-amber-400 rounded-full" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// WEEK VIEW (Israeli work week Sun-Thu focus)
// ========================================
function WeekGrid({ currentDate, selectedDate, onSelectDate, getItemsForDate, getItemContext, onItemClick, onMoveToNote }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-2"
    >
      {days.map((day, idx) => {
        const items = getItemsForDate(day);
        const isTodayDate = isToday(day);
        const isWeekend = idx >= 5; // Friday & Saturday
        const capacity = Math.min(items.length / 5 * 100, 100);

        return (
          <Card
            key={idx}
            className={`shadow-sm transition-all ${
              isTodayDate ? 'border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-200' :
              isWeekend ? 'opacity-60 bg-gray-50/50' :
              'hover:shadow-md'
            }`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectDate(day)}
                    className={`flex items-center gap-2 transition-colors ${isTodayDate ? 'text-emerald-700' : 'text-gray-700 hover:text-emerald-600'}`}
                  >
                    <span className={`text-lg font-bold ${
                      isTodayDate ? 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm' : ''
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <span className="text-sm font-semibold">{DAYS_FULL[idx]}</span>
                  </button>
                  {isTodayDate && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">היום</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Capacity bar */}
                  {items.length > 0 && !isWeekend && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{items.length}/5</span>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            capacity > 80 ? 'bg-amber-500' : capacity > 50 ? 'bg-sky-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${capacity}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {items.length > 0 ? (
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const ctx = getItemContext(item);
                    const config = contextConfig[ctx] || contextConfig.personal;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${config.bg} ${config.border} border cursor-pointer hover:shadow-sm transition-all group`}
                        onClick={() => onItemClick(item)}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                        <span className={`flex-1 text-sm font-medium ${config.text} truncate`}>{item.title}</span>
                        {item.priority && (
                          <div className={`w-2 h-2 rounded-full ${priorityDots[item.priority] || priorityDots.low}`} />
                        )}
                        {item.client_name && (
                          <span className="text-xs text-gray-500 hidden md:inline">{item.client_name}</span>
                        )}
                        {item.itemType === 'task' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onMoveToNote(item); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/50 transition-all"
                            title="העבר לפתק"
                          >
                            <Pin className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">
                  {isWeekend ? '🌿' : 'יום פנוי'}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}

// ========================================
// DAY VIEW (detailed)
// ========================================
function DayDetail({ date, items, getItemContext, onItemClick, onMoveToNote }) {
  const isTodayDate = isToday(date);

  // Group items by context
  const grouped = {};
  items.forEach(item => {
    const ctx = getItemContext(item);
    if (!grouped[ctx]) grouped[ctx] = [];
    grouped[ctx].push(item);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      {/* Day header */}
      <Card className={`shadow-sm ${isTodayDate ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
        <CardContent className="p-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {format(date, 'EEEE', { locale: he })}
          </h2>
          <p className="text-lg text-gray-500">
            {format(date, 'd בMMMM yyyy', { locale: he })}
          </p>
          {items.length > 0 && (
            <div className="flex justify-center gap-3 mt-3">
              {Object.entries(grouped).map(([ctx, ctxItems]) => {
                const config = contextConfig[ctx] || contextConfig.personal;
                return (
                  <Badge key={ctx} className={`${config.bg} ${config.text} ${config.border}`}>
                    {config.label}: {ctxItems.length}
                  </Badge>
                );
              })}
            </div>
          )}
          {/* Capacity */}
          {items.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-sm text-gray-400">עומס:</span>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    items.length > 5 ? 'bg-amber-500' : items.length > 3 ? 'bg-sky-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(items.length / 5 * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-500">{items.length}/5</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items by context */}
      {Object.entries(grouped).map(([ctx, ctxItems]) => {
        const config = contextConfig[ctx] || contextConfig.personal;
        const Icon = config.icon;

        return (
          <Card key={ctx} className={`shadow-sm border ${config.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`flex items-center gap-2 text-base ${config.text}`}>
                <Icon className="w-4 h-4" />
                {config.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ctxItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl ${config.bg} border ${config.border} cursor-pointer hover:shadow-sm transition-all group`}
                  onClick={() => onItemClick(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className={`font-semibold text-base ${config.text}`}>{item.title}</h4>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {item.client_name && <span>{item.client_name}</span>}
                        {item.priority && (
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${priorityDots[item.priority] || priorityDots.low}`} />
                            <span>{item.priority}</span>
                          </div>
                        )}
                        {(item.start_date || item.scheduled_start) && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(safeParseDateString(item.start_date || item.scheduled_start), 'HH:mm', { locale: he })}
                          </span>
                        )}
                        {item.location && <span>📍 {item.location}</span>}
                      </div>
                    </div>
                    {item.itemType === 'task' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMoveToNote(item); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/50 transition-all"
                        title="העבר לפתק"
                      >
                        <Pin className="w-4 h-4 text-amber-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {items.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-lg text-gray-400">יום פנוי</p>
            <p className="text-sm text-gray-300 mt-1">אפשר לנשום 🌿</p>
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
