
import React, { useState, useEffect } from "react";
import { Task, Event } from "@/api/entities";
import { parseISO, format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  ArrowRight, Target, AlertTriangle, ChevronDown, Sparkles,
  FileBarChart, Brain, Zap, Plus, CreditCard, List, LayoutGrid, Search,
  Network, BarChart3
} from "lucide-react";
import MindMapView from "../components/views/MindMapView";
import GanttView from "../components/views/GanttView";
import KanbanView from "../components/tasks/KanbanView";
import TaskEditDialog from "@/components/tasks/TaskEditDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Pencil, Trash2, Pin } from "lucide-react";
import TaskToNoteDialog from "@/components/tasks/TaskToNoteDialog";
import QuickAddTaskDialog from "@/components/tasks/QuickAddTaskDialog";
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';

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

import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';

const FOCUS_TABS = [
  { key: 'overdue', label: 'באיחור', icon: AlertTriangle, color: 'text-red-600', activeBg: 'bg-red-50 border-red-300 text-red-700', badgeColor: 'bg-red-100 text-red-700' },
  { key: 'today', label: 'היום', icon: Target, color: 'text-sky-600', activeBg: 'bg-sky-50 border-sky-300 text-sky-700', badgeColor: 'bg-sky-100 text-sky-700' },
  { key: 'upcoming', label: '3 ימים', icon: Clock, color: 'text-gray-600', activeBg: 'bg-gray-50 border-gray-300 text-gray-700', badgeColor: 'bg-gray-100 text-gray-700' },
  { key: 'events', label: 'אירועים', icon: Calendar, color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-300 text-purple-700', badgeColor: 'bg-purple-100 text-purple-700' },
  { key: 'payment', label: 'ממתין לתשלום', icon: CreditCard, color: 'text-yellow-600', activeBg: 'bg-yellow-50 border-yellow-300 text-yellow-700', badgeColor: 'bg-yellow-100 text-yellow-700' },
];

export default function HomePage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState('overdue');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusView, setFocusView] = useState('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      try {
        const displayName = localStorage.getItem('calmplan_display_name');
        if (displayName) {
          setUserName(displayName);
        } else {
          setUserName('לנה');
        }
      } catch { setUserName('לנה'); }

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

      const allTasks = rawTasks.filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 7) return false;
        if (task.status !== 'completed' && daysSince > 30) return false;
        return true;
      });

      const activeTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant');

      const overdue = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(23, 59, 59, 999);
        return taskDate < today;
      });

      const todayTasks = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
      });

      const upcoming = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= tomorrow && taskDate <= in3Days;
      });

      // Tasks waiting for payment
      const waitingPayment = activeTasks.filter(t => t.status === 'reported_waiting_for_payment');

      const allEvents = Array.isArray(eventsData) ? eventsData : [];
      const todayEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime();
      });

      const workCount = activeTasks.filter(t => getTaskContext(t) === 'work').length;
      const homeCount = activeTasks.filter(t => getTaskContext(t) === 'home').length;

      setData({
        overdue: sortByPriority(overdue),
        today: sortByPriority(todayTasks),
        upcoming: sortByPriority(upcoming),
        payment: sortByPriority(waitingPayment),
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

      // Auto-select first tab with content
      if (overdue.length > 0) setActiveTab('overdue');
      else if (todayTasks.length > 0) setActiveTab('today');
      else if (upcoming.length > 0) setActiveTab('upcoming');
      else if (todayEvents.length > 0) setActiveTab('events');
      else setActiveTab('today');
    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updatePayload = { status: newStatus };
      await Task.update(task.id, updatePayload);
      syncNotesWithTaskStatus(task.id, newStatus);
      setData(prev => {
        if (!prev) return prev;
        const updateInList = (list) => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        const filterCompleted = (list) => list.filter(t => !(t.id === task.id && (newStatus === 'completed' || newStatus === 'not_relevant')));
        return {
          ...prev,
          overdue: filterCompleted(updateInList(prev.overdue)),
          today: filterCompleted(updateInList(prev.today)),
          upcoming: filterCompleted(updateInList(prev.upcoming)),
          payment: newStatus === 'reported_waiting_for_payment'
            ? [...prev.payment, { ...task, status: newStatus }]
            : prev.payment.filter(t => t.id !== task.id),
          completedToday: newStatus === 'completed' ? prev.completedToday + 1 : prev.completedToday,
        };
      });
    } catch (err) {
      console.error('שגיאה בעדכון סטטוס:', err);
    }
  };

  const handlePaymentDateChange = async (task, paymentDate) => {
    try {
      await Task.update(task.id, { payment_due_date: paymentDate });
      setData(prev => {
        if (!prev) return prev;
        const updateDate = (list) => list.map(t => t.id === task.id ? { ...t, payment_due_date: paymentDate } : t);
        return { ...prev, overdue: updateDate(prev.overdue), today: updateDate(prev.today), upcoming: updateDate(prev.upcoming), payment: updateDate(prev.payment) };
      });
    } catch (err) {
      console.error('שגיאה בעדכון תאריך תשלום:', err);
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      loadData();
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
    }
  };

  const handleDeleteTask = async (task) => {
    setEditingTask(null);
    const ok = await confirm({
      title: 'מחיקת משימה',
      description: `האם למחוק את המשימה "${task.title}"?`,
      confirmText: 'מחק',
      cancelText: 'ביטול',
    });
    if (ok) {
      try {
        await Task.delete(task.id);
        loadData();
      } catch (err) {
        console.error('שגיאה במחיקת משימה:', err);
      }
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

  const filterBySearch = (items, isEvent = false) => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      item.title?.toLowerCase().includes(lower) ||
      (!isEvent && item.client_name?.toLowerCase().includes(lower)) ||
      (!isEvent && item.category?.toLowerCase().includes(lower)) ||
      (isEvent && item.description?.toLowerCase().includes(lower))
    );
  };

  const getTabCount = (tabKey) => {
    if (tabKey === 'events') return filterBySearch(data.todayEvents, true).length;
    return filterBySearch(data[tabKey] || []).length;
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'overdue': {
        const filtered = filterBySearch(data.overdue);
        return filtered.length === 0 ? (
          <EmptyState icon={<CheckCircle className="w-10 h-10 text-emerald-400" />} text="אין משימות באיחור" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDeadlineContext />
        );
      }
      case 'today': {
        const filtered = filterBySearch(data.today);
        return filtered.length === 0 ? (
          <EmptyState icon={<Sparkles className="w-10 h-10 text-emerald-400" />} text="אין משימות להיום - כל הכבוד!" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDeadlineContext />
        );
      }
      case 'upcoming': {
        const filtered = filterBySearch(data.upcoming);
        return filtered.length === 0 ? (
          <EmptyState icon={<Clock className="w-10 h-10 text-gray-300" />} text="אין משימות ל-3 ימים הקרובים" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDate />
        );
      }
      case 'events': {
        const filtered = filterBySearch(data.todayEvents, true);
        return filtered.length === 0 ? (
          <EmptyState icon={<Calendar className="w-10 h-10 text-purple-300" />} text="אין אירועים היום" />
        ) : (
          <div className="space-y-2">
            {filtered.map(event => (
              <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                <div className="text-sm font-mono font-semibold text-purple-700 min-w-[50px]">
                  {format(parseISO(event.start_date), 'HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-purple-900 truncate">{event.title}</div>
                  {event.description && <div className="text-xs text-purple-600 truncate">{event.description}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'payment': {
        const filtered = filterBySearch(data.payment);
        return filtered.length === 0 ? (
          <EmptyState icon={<CreditCard className="w-10 h-10 text-yellow-300" />} text="אין משימות ממתינות לתשלום" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showPaymentDate />
        );
      }
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Greeting */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {getGreeting()}{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-sm text-gray-500">
            {format(new Date(), 'EEEE, d בMMMM', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.completedToday > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {data.completedToday} הושלמו היום
            </Badge>
          )}
          <Button size="sm" onClick={() => setShowQuickAdd(true)} className="bg-primary hover:bg-accent text-white gap-1">
            <Plus className="w-4 h-4" />
            משימה מהירה
          </Button>
        </div>
      </motion.div>

      {/* Quick counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to={createPageUrl("Tasks") + "?tab=active&context=work"}>
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
        <Link to={createPageUrl("Tasks") + "?tab=active&context=home"}>
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
              <div className={`text-[11px] ${data.overdue.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>באיחור</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Progress Bar */}
      {(() => {
        const todayTotal = data.today.length + (data.overdue?.length || 0);
        const progress = todayTotal > 0 ? (data.completedToday / (todayTotal + data.completedToday)) * 100 : 0;
        return (
          <motion.div initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">התקדמות יומית</span>
                <span className="text-sm font-bold text-emerald-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {data.completedToday} מתוך {todayTotal + data.completedToday} משימות הושלמו היום
                {progress >= 100 && <span className="mr-2 text-emerald-600 font-medium">כל הכבוד!</span>}
              </p>
            </div>
          </motion.div>
        );
      })()}

      {/* FOCUS AREA: Horizontal Tabs */}
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-5 h-5 text-blue-600" />
                <span>הפוקוס שלי</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <Button variant={focusView === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setFocusView('list')} title="רשימה">
                    <List className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant={focusView === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setFocusView('kanban')} title="קנבן">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant={focusView === 'mindmap' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setFocusView('mindmap')} title="מפת חשיבה">
                    <Network className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant={focusView === 'gantt' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setFocusView('gantt')} title="ציר זמן">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Link to={createPageUrl("Tasks")}>
                  <Button variant="ghost" size="sm" className="text-xs text-gray-500 gap-1">
                    כל המשימות <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חיפוש לפי שם לקוח, משימה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 h-8 text-sm"
              />
            </div>
            {/* Horizontal Tab Bar */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-gray-100">
              {FOCUS_TABS.map(tab => {
                const count = getTabCount(tab.key);
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                      isActive
                        ? `${tab.activeBg} border-current`
                        : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? '' : tab.color}`} />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 min-w-[20px] ${isActive ? tab.badgeColor : 'bg-gray-100 text-gray-500'}`}>
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {focusView === 'mindmap' ? (
              <MindMapView tasks={filterBySearch([...(data.overdue || []), ...(data.today || []), ...(data.upcoming || []), ...(data.payment || [])])} clients={[]} />
            ) : focusView === 'gantt' ? (
              <GanttView tasks={filterBySearch([...(data.overdue || []), ...(data.today || []), ...(data.upcoming || []), ...(data.payment || [])])} clients={[]} />
            ) : focusView === 'kanban' ? (
              <KanbanView
                tasks={filterBySearch([...(data.overdue || []), ...(data.today || []), ...(data.upcoming || []), ...(data.payment || [])])}
                onTaskStatusChange={handleStatusChange}
                onDeleteTask={(taskId) => handleDeleteTask({ id: taskId })}
                onEditTask={handleEditTask}
              />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {getTabContent()}
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
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

      {/* Quick Add Task Dialog */}
      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={loadData}
      />

      {/* Task Edit Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        onDelete={handleDeleteTask}
      />

      <TaskToNoteDialog
        task={noteTask}
        open={!!noteTask}
        onClose={() => setNoteTask(null)}
      />

      {ConfirmDialogComponent}

      {/* FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 left-20 w-14 h-14 bg-primary hover:bg-accent text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="הוסף משימה מהירה"
      >
        <Plus className="w-6 h-6" />
      </button>
    </motion.div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-8">
      <div className="mb-2">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function TaskList({ tasks, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  const [showAll, setShowAll] = useState(false);
  const visibleTasks = showAll ? tasks : tasks.slice(0, 15);

  return (
    <div className="space-y-2">
      {visibleTasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onPaymentDateChange={onPaymentDateChange}
          onEdit={onEdit}
          onNote={onNote}
          showDeadlineContext={showDeadlineContext}
          showDate={showDate}
          showPaymentDate={showPaymentDate}
        />
      ))}
      {tasks.length > 15 && (
        <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => setShowAll(!showAll)}>
          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'הצג פחות' : `עוד ${tasks.length - 15} משימות`}
        </Button>
      )}
    </div>
  );
}

function TaskRow({ task, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  const ctx = getTaskContext(task);
  const isWork = ctx === 'work';
  const isHome = ctx === 'home';

  const priorityStyles = {
    urgent: 'border-r-4 border-r-red-500',
    high: 'border-r-4 border-r-orange-400',
    medium: 'border-r-4 border-r-yellow-400',
    low: 'border-r-4 border-r-gray-300',
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysFromDue = task.due_date ? differenceInDays(today, parseISO(task.due_date)) : 0;
  const isOverdue = daysFromDue > 0;

  const statusCfg = statusConfig[task.status] || statusConfig.not_started;

  // Payment date tracking
  const paymentDaysLeft = task.payment_due_date
    ? differenceInDays(parseISO(task.payment_due_date), today)
    : null;

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors ${priorityStyles[task.priority] || 'border-r-4 border-r-gray-200'} ${isOverdue ? 'bg-amber-50/30' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.priority === 'urgent' && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">דחוף</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.client_name && (
            <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{task.client_name}</span>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{task.category}</Badge>
          )}
          {showDeadlineContext && isOverdue && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
              {daysFromDue === 1 ? 'אתמול' : `${daysFromDue} ימים באיחור`}
            </Badge>
          )}
          {showDeadlineContext && !isOverdue && task.due_date && (
            <span className="text-[10px] text-gray-400">היום - {format(parseISO(task.due_date), 'd/M')}</span>
          )}
          {showDate && task.due_date && (
            <span className="text-[10px] text-gray-400">
              {isTomorrow(parseISO(task.due_date)) ? 'מחר' : format(parseISO(task.due_date), 'd/M')}
            </span>
          )}
          {/* Payment date info */}
          {showPaymentDate && task.payment_due_date && (
            <Badge className={`text-[10px] px-1.5 py-0 ${paymentDaysLeft <= 0 ? 'bg-red-100 text-red-700' : paymentDaysLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {paymentDaysLeft < 0 ? `${Math.abs(paymentDaysLeft)} ימים באיחור תשלום` : paymentDaysLeft === 0 ? 'תשלום היום' : `${paymentDaysLeft} ימים לתשלום`}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onNote && (
          <button
            onClick={() => onNote(task)}
            className="p-1 rounded hover:bg-amber-100 transition-colors"
            title="הוסף לפתק דביק"
          >
            <Pin className="w-3.5 h-3.5 text-gray-400 hover:text-amber-600" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            title="ערוך משימה"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
        {/* Payment due date input - shows for reported_waiting_for_payment */}
        {task.status === 'reported_waiting_for_payment' && onPaymentDateChange && (
          <input
            type="date"
            value={task.payment_due_date || ''}
            onChange={(e) => onPaymentDateChange(task, e.target.value)}
            className="h-7 text-[10px] px-1.5 w-[110px] border border-yellow-300 rounded bg-yellow-50 text-yellow-800"
            title="תאריך יעד לתשלום"
          />
        )}
        {onStatusChange && (
          <Select value={task.status || 'not_started'} onValueChange={(newStatus) => onStatusChange(task, newStatus)}>
            <SelectTrigger className={`h-7 text-[10px] px-2 w-auto min-w-[90px] border-0 ${statusCfg.color}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([key, { text }]) => (
                <SelectItem key={key} value={key} className="text-xs">{text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
