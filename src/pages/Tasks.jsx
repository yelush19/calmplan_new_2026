
import React, { useState, useEffect, useMemo } from "react";
import { Task, Client } from "@/api/entities";
import { createNoteFromTask } from "@/components/StickyNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, User, CheckCircle, Search, List, LayoutGrid, Trash2,
  ChevronDown, ChevronRight, ChevronUp, RefreshCw, Pin, ExternalLink,
  ArrowUpDown, Clock, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { format, parseISO, isValid, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import KanbanView from "../components/tasks/KanbanView";
import MultiStatusFilter from '@/components/ui/MultiStatusFilter';
import ResizableTable from '@/components/ui/ResizableTable';

const statusConfig = {
  not_started: { text: 'לביצוע', color: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-400' },
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

// Time period tabs
const now = new Date();
const prevMonthStart = startOfMonth(subMonths(now, 1));
const prevMonthEnd = endOfMonth(subMonths(now, 1));
const currMonthStart = startOfMonth(now);
const currMonthEnd = endOfMonth(now);

const TIME_TABS = [
  { key: 'prev_month', label: format(subMonths(now, 1), 'MMMM', { locale: he }), icon: Calendar },
  { key: 'curr_month', label: format(now, 'MMMM', { locale: he }), icon: Clock },
  { key: 'active', label: 'פעילות', icon: AlertTriangle },
  { key: 'completed', label: 'הושלמו', icon: CheckCircle },
  { key: 'all', label: 'הכל', icon: List },
];

const getCategoryLabel = (cat) => {
  const labels = {
    'מע"מ': 'מע"מ', 'מקדמות מס': 'מקדמות', 'ניכויים': 'ניכויים',
    'ביטוח לאומי': 'ב"ל', 'שכר': 'שכר', 'דוח שנתי': 'שנתי',
    'work_vat_reporting': 'מע"מ', 'work_tax_advances': 'מקדמות',
    'work_deductions': 'ניכויים', 'work_social_security': 'ב"ל',
    'work_payroll': 'שכר', 'work_client_management': 'ניהול',
  };
  return labels[cat] || cat;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [view, setView] = useState("list");
  const [isClearing, setIsClearing] = useState(false);
  const [clientMap, setClientMap] = useState({});
  const [timeTab, setTimeTab] = useState('prev_month');
  const [sortField, setSortField] = useState('due_date');
  const [sortDir, setSortDir] = useState('asc');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const priorityParam = params.get('priority');
    if (statusParam) setStatusFilter([statusParam]);
    if (priorityParam) setPriorityFilter(priorityParam);
  }, [location.search]);

  useEffect(() => { loadTasks(); loadClients(); }, []);

  const loadClients = async () => {
    try {
      const clients = await Client.list(null, 500);
      const map = {};
      (clients || []).forEach(c => { if (c.name) map[c.name] = c.id; });
      setClientMap(map);
    } catch { setClientMap({}); }
  };

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const allTasks = await Task.list("-due_date", 5000).catch(() => []);
      const validTasks = Array.isArray(allTasks) ? allTasks : [];
      const processed = validTasks.map(task => {
        let normalizedStatus = task.status;
        if (task.status && mondayStatusMapping[task.status]) {
          normalizedStatus = mondayStatusMapping[task.status];
        } else if (!task.status || !statusConfig[task.status]) {
          normalizedStatus = 'not_started';
        }
        return { ...task, status: normalizedStatus };
      });
      setTasks(processed);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]);
    }
    setIsLoading(false);
  };

  const categories = useMemo(() => {
    const cats = new Set();
    tasks.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [tasks]);

  // Time-based filtering
  const timeFilteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const dueDate = task.due_date ? parseISO(task.due_date) : null;
      switch (timeTab) {
        case 'prev_month':
          return dueDate && dueDate >= prevMonthStart && dueDate <= prevMonthEnd;
        case 'curr_month':
          return dueDate && dueDate >= currMonthStart && dueDate <= currMonthEnd;
        case 'active':
          return task.status !== 'completed' && task.status !== 'not_relevant';
        case 'completed':
          return task.status === 'completed';
        case 'all':
        default:
          return true;
      }
    });
  }, [tasks, timeTab]);

  // Search + status + priority + category filtering
  const filteredTasks = useMemo(() => {
    let result = [...timeFilteredTasks];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      );
    }
    if (statusFilter.length > 0) {
      result = result.filter(t => statusFilter.includes(t.status));
    }
    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter(t => t.category === categoryFilter);
    }
    return result;
  }, [timeFilteredTasks, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Sorting
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'client_name':
          cmp = (a.client_name || '').localeCompare(b.client_name || '', 'he');
          break;
        case 'category':
          cmp = (getCategoryLabel(a.category || '')).localeCompare(getCategoryLabel(b.category || ''), 'he');
          break;
        case 'due_date':
          cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999');
          break;
        case 'status': {
          const statusOrder = ['not_started','in_progress','waiting_for_materials','waiting_for_approval','ready_for_reporting','reported_waiting_for_payment','issue','postponed','completed','not_relevant'];
          cmp = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
          break;
        }
        case 'priority': {
          const pa = priorityConfig[a.priority]?.order ?? 9;
          const pb = priorityConfig[b.priority]?.order ?? 9;
          cmp = pa - pb;
          break;
        }
        default:
          cmp = (a.title || '').localeCompare(b.title || '', 'he');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredTasks, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    return { total, completed, inProgress };
  }, [filteredTasks]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

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

  const SortHeader = ({ field, children }) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        className="px-3 py-2.5 text-right text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap bg-white"
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300" />
          )}
        </div>
      </th>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
          <p className="text-lg text-gray-500">טוען משימות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
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
          <Button variant="ghost" size="sm" onClick={loadTasks} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Time Period Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TIME_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = timeTab === tab.key;
          const count = tasks.filter(t => {
            const d = t.due_date ? parseISO(t.due_date) : null;
            switch (tab.key) {
              case 'prev_month': return d && d >= prevMonthStart && d <= prevMonthEnd;
              case 'curr_month': return d && d >= currMonthStart && d <= currMonthEnd;
              case 'active': return t.status !== 'completed' && t.status !== 'not_relevant';
              case 'completed': return t.status === 'completed';
              case 'all': return true;
              default: return true;
            }
          }).length;
          return (
            <button
              key={tab.key}
              onClick={() => setTimeTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <Badge className={`text-[10px] px-1.5 py-0 h-4 min-w-[20px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
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
            <MultiStatusFilter
              options={Object.entries(statusConfig).map(([key, { text }]) => ({
                value: key, label: text,
                count: timeFilteredTasks.filter(t => t.status === key).length,
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
              label="סטטוס"
            />
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

      {/* Content */}
      {view === 'list' ? (
        sortedTasks.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-lg">אין משימות</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <ResizableTable
              className="w-full text-sm"
              stickyHeader
              maxHeight="70vh"
            >
              <thead>
                <tr className="border-b border-gray-200">
                  <SortHeader field="client_name">לקוח</SortHeader>
                  <SortHeader field="category">סוג דיווח</SortHeader>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600 bg-white">תיאור</th>
                  <SortHeader field="due_date">תאריך יעד</SortHeader>
                  <SortHeader field="status">סטטוס</SortHeader>
                  <SortHeader field="priority">עדיפות</SortHeader>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600 bg-white w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map(task => {
                  const sts = statusConfig[task.status] || statusConfig.not_started;
                  const pri = priorityConfig[task.priority] || priorityConfig.medium;
                  const isCompleted = task.status === 'completed';
                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isCompleted ? 'opacity-50' : ''}`}
                    >
                      {/* Client */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">
                            {task.client_name || '-'}
                          </span>
                          {clientMap[task.client_name] && (
                            <button
                              onClick={() => navigate(`/ClientManagement?clientId=${clientMap[task.client_name]}`)}
                              className="p-0.5 rounded hover:bg-primary/10 transition-colors shrink-0"
                              title="פתח כרטיס לקוח"
                            >
                              <ExternalLink className="w-3 h-3 text-primary" />
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Category */}
                      <td className="px-3 py-2">
                        {task.category ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {getCategoryLabel(task.category)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      {/* Title / description */}
                      <td className="px-3 py-2">
                        <p className={`text-sm truncate max-w-[250px] ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[10px] text-gray-400 truncate max-w-[250px]">
                            {task.description.slice(0, 50)}
                          </p>
                        )}
                      </td>
                      {/* Due date */}
                      <td className="px-3 py-2">
                        <span className="text-xs font-mono text-gray-600">
                          {formatDate(task.due_date) || '-'}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2">
                        <Select
                          value={task.status}
                          onValueChange={(newStatus) => handleStatusChange(task, newStatus)}
                        >
                          <SelectTrigger className="w-28 h-7 rounded-lg text-[10px] border-0 bg-gray-50">
                            <div className="flex items-center gap-1.5">
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
                      </td>
                      {/* Priority */}
                      <td className="px-3 py-2">
                        <Badge className={`text-[10px] px-2 py-0.5 ${pri.color}`}>
                          {pri.text}
                        </Badge>
                      </td>
                      {/* Actions */}
                      <td className="px-2 py-2">
                        <button
                          onClick={() => createNoteFromTask(task)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                          title="העבר לפתק"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ResizableTable>
          </Card>
        )
      ) : (
        <KanbanView
          tasks={filteredTasks}
          onTaskStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
          formatDate={formatDate}
          getPriorityColor={(p) => priorityConfig[p]?.color || priorityConfig.medium.color}
          getStatusColor={(s) => statusConfig[s]?.color || statusConfig.not_started.color}
          getStatusText={(s) => statusConfig[s]?.text || s}
          getPriorityText={(p) => priorityConfig[p]?.text || p}
        />
      )}

      {/* Bottom: clear all */}
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
