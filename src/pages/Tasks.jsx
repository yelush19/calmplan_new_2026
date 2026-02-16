
import React, { useState, useEffect, useMemo } from "react";
import { Task } from "@/api/entities";
import { createNoteFromTask } from "@/components/StickyNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, User, CheckCircle, Search, List, LayoutGrid, Trash2,
  ChevronDown, ChevronRight, RefreshCw, Pin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { format, parseISO, isValid, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import KanbanView from "../components/tasks/KanbanView";

const statusConfig = {
  not_started: { text: 'לביצוע', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  in_progress: { text: 'בעבודה', color: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  completed: { text: 'הושלם', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  postponed: { text: 'נדחה', color: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  waiting_for_approval: { text: 'לבדיקה', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  waiting_for_materials: { text: 'ממתין לחומרים', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  issue: { text: 'בעיה', color: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  ready_for_reporting: { text: 'מוכן לדיווח', color: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  reported_waiting_for_payment: { text: 'ממתין לתשלום', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  not_relevant: { text: 'לא רלוונטי', color: 'bg-gray-50 text-gray-400', dot: 'bg-gray-300' },
};

const priorityConfig = {
  low: { text: 'נמוך', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400', order: 3 },
  medium: { text: 'בינוני', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', order: 2 },
  high: { text: 'גבוה', color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400', order: 1 },
  urgent: { text: 'דחוף', color: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', order: 0 },
};

// Monday status mapping
const mondayStatusMapping = {
  'ממתין לחומרים': 'waiting_for_materials',
  'בעבודה': 'in_progress',
  'ממתין לתחילת העבודה': 'not_started',
  'לבדיקה': 'waiting_for_approval',
  'מוכן לדיווח': 'ready_for_reporting',
  'דיווח ממתין לתשלום': 'reported_waiting_for_payment',
  'דווח ושולם': 'completed',
  'בעיה': 'issue',
  'נדחה': 'postponed',
  'ממתין_לחומרים': 'waiting_for_materials',
  'ממתין_לתחילת_העבודה': 'not_started',
  'מוכן_לדיווח': 'ready_for_reporting',
  'דיווח_ממתין_לתשלום': 'reported_waiting_for_payment',
  'דווח_ושולם': 'completed',
  'בוצע': 'completed',
  'הושלם': 'completed',
  'סיום': 'completed',
  'ביצוע': 'in_progress',
  'ממתין לתשלום': 'reported_waiting_for_payment',
  'ממתין לאישור': 'waiting_for_approval',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [view, setView] = useState("list");
  const [isClearing, setIsClearing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const priorityParam = params.get('priority');
    if (statusParam) setStatusFilter(statusParam);
    if (priorityParam) setPriorityFilter(priorityParam);
  }, [location.search]);

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      // Load ALL tasks — unified view
      const allTasks = await Task.list("-due_date", 5000).catch(() => []);
      const validTasks = Array.isArray(allTasks) ? allTasks : [];

      // Normalize statuses and filter stale
      const now = Date.now();
      const processed = validTasks
        .map(task => {
          let normalizedStatus = task.status;
          if (task.status && mondayStatusMapping[task.status]) {
            normalizedStatus = mondayStatusMapping[task.status];
          } else if (!task.status || !statusConfig[task.status]) {
            normalizedStatus = 'not_started';
          }
          return { ...task, status: normalizedStatus };
        })
        .filter(task => {
          const taskDate = task.due_date || task.created_date;
          if (!taskDate) return true;
          const daysSince = Math.floor((now - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
          if (task.status === 'completed' && daysSince > 60) return false;
          if (task.status !== 'completed' && daysSince > 180) return false;
          return true;
        });

      setTasks(processed);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]);
    }
    setIsLoading(false);
  };

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set();
    tasks.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [tasks]);

  // Category display names
  const getCategoryLabel = (cat) => {
    const labels = {
      'מע"מ': 'מע"מ',
      'מקדמות מס': 'מקדמות',
      'ניכויים': 'ניכויים',
      'ביטוח לאומי': 'ב"ל',
      'שכר': 'שכר',
      'דוח שנתי': 'שנתי',
      'work_vat_reporting': 'מע"מ',
      'work_tax_advances': 'מקדמות',
      'work_deductions': 'ניכויים',
      'work_social_security': 'ב"ל',
      'work_payroll': 'שכר',
      'work_client_management': 'ניהול',
    };
    return labels[cat] || cat;
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter(t => t.category === categoryFilter);
    }

    // Sort: priority first, then due date
    result.sort((a, b) => {
      const pa = priorityConfig[a.priority]?.order ?? 9;
      const pb = priorityConfig[b.priority]?.order ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.due_date || '9999').localeCompare(b.due_date || '9999');
    });

    return result;
  }, [tasks, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Group by client name
  const groupedByClient = useMemo(() => {
    const groups = {};
    for (const task of filteredTasks) {
      const key = task.client_name || 'ללא לקוח';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'he'));
  }, [filteredTasks]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const waiting = filteredTasks.filter(t =>
      ['waiting_for_materials', 'waiting_for_approval', 'ready_for_reporting'].includes(t.status)
    ).length;
    return { total, completed, inProgress, waiting };
  }, [filteredTasks]);

  const handleStatusChange = async (task, newStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      await Task.update(task.id, { ...task, status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      loadTasks();
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm("למחוק משימה זו?")) {
      try {
        await Task.delete(taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleClearAllTasks = async () => {
    const count = tasks.length;
    if (!window.confirm(`למחוק את כל ${count} המשימות? פעולה בלתי הפיכה!`)) return;
    if (!window.confirm('בטוח? לא ניתן לשחזר.')) return;
    setIsClearing(true);
    try {
      await Task.deleteAll();
      setTasks([]);
    } catch (error) {
      console.error('Error clearing tasks:', error);
    }
    setIsClearing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, "dd/MM", { locale: he }) : dateString;
    } catch { return dateString; }
  };

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getPriorityColor = (priority) => priorityConfig[priority]?.color || priorityConfig.medium.color;
  const getStatusColor = (status) => statusConfig[status]?.color || statusConfig.not_started.color;
  const getStatusText = (status) => statusConfig[status]?.text || status;
  const getPriorityText = (priority) => priorityConfig[priority]?.text || priority;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#657453]/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-[#657453]" />
          </div>
          <p className="text-lg text-gray-500">טוען משימות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">כל המשימות</h1>
          <p className="text-base text-gray-500 mt-1">
            {stats.total} משימות | {stats.completed} הושלמו | {stats.inProgress} בעבודה
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl p-1 shadow-sm border">
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')}>
              <List className="w-5 h-5" />
            </Button>
            <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('kanban')}>
              <LayoutGrid className="w-5 h-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTasks}
            className="rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters — clean, compact */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="חיפוש לפי שם משימה, לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 rounded-xl"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 rounded-xl">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(statusConfig).map(([key, { text }]) => (
                  <SelectItem key={key} value={key}>{text}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-36 rounded-xl">
                <SelectValue placeholder="עדיפות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל העדיפויות</SelectItem>
                {Object.entries(priorityConfig).map(([key, { text }]) => (
                  <SelectItem key={key} value={key}>{text}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-36 rounded-xl">
                <SelectValue placeholder="סוג" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task list */}
      {view === 'list' ? (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-lg">אין משימות</p>
              </CardContent>
            </Card>
          ) : (
            groupedByClient.map(([clientName, clientTasks]) => {
              const isCollapsed = collapsedGroups.has(clientName);
              const completedCount = clientTasks.filter(t => t.status === 'completed').length;
              return (
                <motion.div
                  key={clientName}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-0 shadow-sm overflow-hidden">
                    {/* Client group header */}
                    <div
                      className="flex items-center justify-between px-5 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleGroup(clientName)}
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                        <span className="text-base font-bold text-gray-700">{clientName}</span>
                        <span className="text-sm text-gray-400">
                          {completedCount}/{clientTasks.length}
                        </span>
                      </div>
                      {/* Mini capacity bar */}
                      <div className="flex gap-0.5">
                        {clientTasks.map((t, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-4 rounded-full ${
                              t.status === 'completed' ? 'bg-emerald-400'
                              : t.status === 'in_progress' ? 'bg-sky-400'
                              : 'bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Tasks in group */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-gray-50">
                            {clientTasks.map(task => {
                              const pri = priorityConfig[task.priority] || priorityConfig.medium;
                              const sts = statusConfig[task.status] || statusConfig.not_started;
                              const isCompleted = task.status === 'completed';
                              return (
                                <div
                                  key={task.id}
                                  className={`flex items-center gap-4 px-5 py-3 transition-all ${
                                    isCompleted ? 'opacity-40' : ''
                                  }`}
                                >
                                  {/* Priority dot */}
                                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pri.dot}`} />

                                  {/* Task info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${
                                      isCompleted ? 'line-through text-gray-400' : 'text-gray-800'
                                    }`}>
                                      {task.title}
                                    </p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      {task.category && (
                                        <span className="text-xs text-gray-400">
                                          {getCategoryLabel(task.category)}
                                        </span>
                                      )}
                                      {task.due_date && (
                                        <span className="text-xs text-[#657453] font-medium">
                                          {formatDate(task.due_date)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status selector */}
                                  <Select
                                    value={task.status}
                                    onValueChange={(newStatus) => handleStatusChange(task, newStatus)}
                                  >
                                    <SelectTrigger className="w-32 h-8 rounded-lg text-xs border-0 bg-gray-50">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${sts.dot}`} />
                                        <SelectValue />
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(statusConfig).map(([key, { text, dot }]) => (
                                        <SelectItem key={key} value={key}>
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${dot}`} />
                                            {text}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {/* Pin to sticky note */}
                                  <button
                                    onClick={() => createNoteFromTask(task)}
                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                                    title="העבר לפתק"
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        <KanbanView
          tasks={filteredTasks}
          onTaskStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
          formatDate={formatDate}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          getPriorityText={getPriorityText}
        />
      )}

      {/* Bottom: clear all (hidden in corner) */}
      {tasks.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllTasks}
            disabled={isClearing}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-3 h-3 ml-1" />
            {isClearing ? 'מוחק...' : 'מחק הכל'}
          </Button>
        </div>
      )}
    </div>
  );
}
