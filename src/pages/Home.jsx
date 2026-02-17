
import React, { useState, useEffect, useCallback } from "react";
import { Task, Event, User } from "@/api/entities";
import { parseISO, format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  ArrowRight, Target, AlertTriangle, ChevronDown, Sparkles,
  FileBarChart, Brain, Zap
} from "lucide-react";
import StickyNotes from "@/components/StickyNotes";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
};

function getTaskContext(task) {
  if (task.context === 'work' || task.context === 'home') return task.context;
  const cat = task.category || '';
  if (['מע"מ','מקדמות מס','ניכויים','ביטוח לאומי','שכר'].includes(cat)) return 'work';
  if (cat === 'home' || cat === 'personal') return 'home';
  if (task.client_name) return 'work';
  return 'other';
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(a.due_date || 0) - new Date(b.due_date || 0);
  });
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      try {
        const user = await User.me();
        if (user?.full_name) setUserName(user.full_name.split(" ")[0]);
      } catch { /* no user */ }

      const [tasksData, eventsData] = await Promise.all([
        Task.list("-due_date", 5000).catch(() => []),
        Event.list("-start_date", 500).catch(() => []),
      ]);

      const rawTasks = Array.isArray(tasksData) ? tasksData : [];
      const nowMs = Date.now();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const in3Days = new Date(today);
      in3Days.setDate(in3Days.getDate() + 3);

      // Filter out very old tasks
      const allTasks = rawTasks.filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 7) return false;
        if (task.status !== 'completed' && daysSince > 30) return false;
        return true;
      });

      const activeTasks = allTasks.filter(t => t.status !== 'completed');

      // Overdue
      const overdue = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(23, 59, 59, 999);
        return taskDate < today;
      });

      // Today
      const todayTasks = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
      });

      // Next 3 days
      const upcoming = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= tomorrow && taskDate <= in3Days;
      });

      // Events
      const allEvents = Array.isArray(eventsData) ? eventsData : [];
      const todayEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime();
      });

      // Counts
      const workCount = activeTasks.filter(t => getTaskContext(t) === 'work').length;
      const homeCount = activeTasks.filter(t => getTaskContext(t) === 'home').length;

      setData({
        overdue: sortByPriority(overdue),
        today: sortByPriority(todayTasks),
        upcoming: sortByPriority(upcoming),
        todayEvents,
        workCount,
        homeCount,
        totalActive: activeTasks.length,
        completedToday: allTasks.filter(t => {
          if (t.status !== 'completed') return false;
          const d = t.updated_date || t.due_date;
          if (!d) return false;
          try { return isToday(parseISO(d)); } catch { return false; }
        }).length,
      });
    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  const hasUrgent = data.overdue.length > 0 || data.today.some(t => t.priority === 'urgent');

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Greeting - compact */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {getGreeting()}{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-sm text-gray-500">
            {format(new Date(), 'EEEE, d בMMMM', { locale: he })}
          </p>
        </div>
        {data.completedToday > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            {data.completedToday} הושלמו היום
          </Badge>
        )}
      </motion.div>

      {/* Quick counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to={createPageUrl("Tasks?context=work")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200 bg-blue-50/70">
            <CardContent className="p-3 flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xl font-bold text-blue-700">{data.workCount}</div>
                <div className="text-[11px] text-blue-600">משימות עבודה</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("Tasks?context=home")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200 bg-green-50/70">
            <CardContent className="p-3 flex items-center gap-3">
              <HomeIcon className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-xl font-bold text-green-700">{data.homeCount}</div>
                <div className="text-[11px] text-green-600">משימות בית</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("Calendar")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-purple-200 bg-purple-50/70">
            <CardContent className="p-3 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-xl font-bold text-purple-700">{data.todayEvents.length}</div>
                <div className="text-[11px] text-purple-600">אירועים היום</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card className={`border-2 ${data.overdue.length > 0 ? 'border-amber-300 bg-amber-50/70' : 'border-gray-200 bg-gray-50/70'}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className={`w-5 h-5 ${data.overdue.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            <div>
              <div className={`text-xl font-bold ${data.overdue.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                {data.overdue.length}
              </div>
              <div className={`text-[11px] ${data.overdue.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                באיחור
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OVERDUE - alert style, max 3 visible */}
      {data.overdue.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border-amber-300 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-amber-800">משימות באיחור</span>
                <Badge className="bg-amber-200 text-amber-800 text-xs">{data.overdue.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(showAllOverdue ? data.overdue : data.overdue.slice(0, 3)).map(task => (
                <TaskRow key={task.id} task={task} showDaysOverdue />
              ))}
              {data.overdue.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                  onClick={() => setShowAllOverdue(!showAllOverdue)}
                >
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAllOverdue ? 'rotate-180' : ''}`} />
                  {showAllOverdue ? 'הצג פחות' : `עוד ${data.overdue.length - 3} משימות`}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* TODAY'S EVENTS */}
      {data.todayEvents.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <Card className="border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span>אירועים היום</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.todayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                  <div className="text-sm font-mono font-semibold text-purple-700 min-w-[50px]">
                    {format(parseISO(event.start_date), 'HH:mm')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-purple-900 truncate">{event.title}</div>
                    {event.description && (
                      <div className="text-xs text-purple-600 truncate">{event.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* TODAY'S FOCUS - tasks for today */}
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-5 h-5 text-blue-600" />
                <span>הפוקוס להיום</span>
                {data.today.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{data.today.length}</Badge>
                )}
              </CardTitle>
              <Link to={createPageUrl("Tasks")}>
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 gap-1">
                  כל המשימות <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.today.length === 0 ? (
              <div className="text-center py-6">
                <Sparkles className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-gray-500">אין משימות מתוכננות להיום</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.today.slice(0, 7).map(task => (
                  <TaskRow key={task.id} task={task} />
                ))}
                {data.today.length > 7 && (
                  <Link to={createPageUrl("Tasks")}>
                    <Button variant="ghost" size="sm" className="w-full text-gray-500">
                      עוד {data.today.length - 7} משימות...
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* UPCOMING 3 DAYS */}
      {data.upcoming.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-gray-500" />
                <span>3 ימים הקרובים</span>
                <Badge variant="secondary" className="text-xs">{data.upcoming.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcoming.slice(0, 5).map(task => (
                <TaskRow key={task.id} task={task} showDate />
              ))}
              {data.upcoming.length > 5 && (
                <Link to={createPageUrl("Tasks")}>
                  <Button variant="ghost" size="sm" className="w-full text-gray-500">
                    עוד {data.upcoming.length - 5} משימות...
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Sticky Notes - compact */}
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
        <Card className="border-amber-200/50 bg-amber-50/20">
          <CardContent className="p-4">
            <StickyNotes compact={true} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions - compact grid */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <Link to={createPageUrl("WeeklyPlanningDashboard")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200 bg-blue-50/50 h-full">
            <CardContent className="p-4 text-center">
              <Brain className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <h3 className="font-medium text-sm text-blue-800">תכנון שבועי</h3>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("PayrollDashboard")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200 bg-gray-50/50 h-full">
            <CardContent className="p-4 text-center">
              <Briefcase className="w-6 h-6 mx-auto mb-2 text-gray-600" />
              <h3 className="font-medium text-sm text-gray-800">שכר ודיווחים</h3>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("AutomationRules")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-yellow-200 bg-yellow-50/50 h-full">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
              <h3 className="font-medium text-sm text-yellow-800">אוטומציות</h3>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("WeeklySummary")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-orange-200 bg-orange-50/50 h-full">
            <CardContent className="p-4 text-center">
              <FileBarChart className="w-6 h-6 mx-auto mb-2 text-orange-600" />
              <h3 className="font-medium text-sm text-orange-800">סיכום שבועי</h3>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    </motion.div>
  );
}

function TaskRow({ task, showDaysOverdue, showDate }) {
  const ctx = getTaskContext(task);
  const isWork = ctx === 'work';
  const isHome = ctx === 'home';

  const priorityStyles = {
    urgent: 'border-r-4 border-r-red-500',
    high: 'border-r-4 border-r-orange-400',
    medium: 'border-r-4 border-r-yellow-400',
    low: 'border-r-4 border-r-gray-300',
  };

  const daysOverdue = task.due_date
    ? differenceInDays(new Date(), parseISO(task.due_date))
    : 0;

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors ${priorityStyles[task.priority] || 'border-r-4 border-r-gray-200'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.priority === 'urgent' && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">דחוף</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.client_name && (
            <span className="text-[11px] text-gray-500 truncate max-w-[150px]">{task.client_name}</span>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{task.category}</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showDaysOverdue && daysOverdue > 0 && (
          <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">
            {daysOverdue} ימים
          </Badge>
        )}
        {showDate && task.due_date && (
          <span className="text-[11px] text-gray-400">
            {isTomorrow(parseISO(task.due_date)) ? 'מחר' : format(parseISO(task.due_date), 'd/M')}
          </span>
        )}
        {isWork ? (
          <Briefcase className="w-3.5 h-3.5 text-blue-500" />
        ) : isHome ? (
          <HomeIcon className="w-3.5 h-3.5 text-green-500" />
        ) : null}
      </div>
    </div>
  );
}
