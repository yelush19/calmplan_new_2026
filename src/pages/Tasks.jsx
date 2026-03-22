
import React, { useState, useEffect, useMemo } from "react";
import { Task, Client } from "@/api/entities";
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, User, CheckCircle, Search, List, LayoutGrid, Trash2, Pencil,
  ChevronDown, ChevronRight, ChevronUp, RefreshCw, Pin, ExternalLink, Plus,
  ArrowUpDown, Clock, AlertTriangle, Briefcase, Home as HomeIcon, X,
  Network, BarChart3, GitBranchPlus
} from "lucide-react";
import { cleanupGhostTasks } from '@/api/functions';
import MindMapView from "../components/views/MindMapView";
import GanttView from "../components/views/GanttView";
import { getActiveTreeTasks, getTaskPBranch, getPBranchLabel } from '@/utils/taskTreeFilter';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { format, parseISO, isValid, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import KanbanView from "../components/tasks/KanbanView";
import MultiStatusFilter from '@/components/ui/MultiStatusFilter';
import ResizableTable from '@/components/ui/ResizableTable';
import useTaskCascade from '@/hooks/useTaskCascade';
import ClientRecurringTasks from '@/components/clients/ClientRecurringTasks';
import { useConfirm } from '@/components/ui/ConfirmDialog';

import { TASK_STATUS_CONFIG as statusConfig, STATUS_CONFIG } from '@/config/processTemplates';
import { getCategoryLabel } from '@/utils/categoryLabels';
import { useDesign } from '@/contexts/DesignContext';

// Error Boundary to prevent white screen crashes
class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ViewErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-500 gap-4 p-8">
          <div className="text-4xl">⚠️</div>
          <p className="text-lg font-bold text-gray-700">שגיאה בטעינת התצוגה</p>
          <p className="text-sm text-gray-500 max-w-md text-center">{String(this.state.error?.message || this.state.error)}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => { try { localStorage.removeItem('mindmap-positions'); } catch {} this.setState({ hasError: false, error: null }); }}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-700"
            >
              אפס ונסה שוב
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-300"
            >
              רענן דף
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 5 Golden Statuses — display order
const STATUS_GROUP_ORDER = [
  'waiting_for_materials', 'not_started', 'sent_for_review', 'needs_corrections', 'production_completed',
];
// Default: ALL status groups start collapsed for zero-scroll policy
const DEFAULT_COLLAPSED_STATUSES = new Set(['waiting_for_materials', 'not_started', 'sent_for_review', 'needs_corrections', 'production_completed']);

function getTaskContext(task) {
  if (task.context === 'work' || task.context === 'home') return task.context;
  const cat = task.category || '';
  if (['מע"מ','מקדמות מס','ניכויים','ביטוח לאומי','שכר'].includes(cat)) return 'work';
  if (cat === 'home' || cat === 'personal') return 'home';
  if (task.client_name) return 'work';
  return 'other';
}

const priorityConfig = {
  low: { text: 'נמוך', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400', order: 3 },
  medium: { text: 'בינוני', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', order: 2 },
  high: { text: 'גבוה', color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400', order: 1 },
  urgent: { text: 'דחוף', color: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500', order: 0 },
};

// Hebrew → golden status migration for imported data
const mondayStatusMapping = {
  'ממתין לחומרים': 'waiting_for_materials',
  'בעבודה': 'not_started',
  'ממתין לתחילת העבודה': 'not_started',
  'לבדיקה': 'sent_for_review',
  'מוכן לדיווח': 'sent_for_review',
  'דיווח ממתין לתשלום': 'not_started',
  'דווח ושולם': 'production_completed',
  'בעיה': 'needs_corrections',
  'נדחה': 'not_started',
  'ממתין_לחומרים': 'waiting_for_materials',
  'ממתין_לתחילת_העבודה': 'not_started',
  'מוכן_לדיווח': 'sent_for_review',
  'דיווח_ממתין_לתשלום': 'not_started',
  'דווח_ושולם': 'production_completed',
  'בוצע': 'production_completed',
  'הושלם': 'production_completed',
  'הושלם ייצור': 'production_completed',
  'סיום': 'production_completed',
  'ביצוע': 'not_started',
  'ממתין לתשלום': 'not_started',
  'ממתין לאישור': 'sent_for_review',
  'ממתין ללקוח': 'waiting_for_materials',
  'לבצע': 'not_started',
  'הועבר לעיון': 'sent_for_review',
  'לבצע תיקונים': 'needs_corrections',
};

// Time period tabs
function getTimePeriods() {
  const now = new Date();
  return {
    now,
    prevMonthStart: startOfMonth(subMonths(now, 1)),
    prevMonthEnd: endOfMonth(subMonths(now, 1)),
    currMonthStart: startOfMonth(now),
    currMonthEnd: endOfMonth(now),
    tabs: [
      { key: 'active', label: 'פעילות (כל התקופות)', icon: AlertTriangle },
      { key: 'prev_month', label: format(subMonths(now, 1), 'MMMM', { locale: he }), icon: Calendar },
      { key: 'curr_month', label: format(now, 'MMMM', { locale: he }), icon: Clock },
      { key: 'all', label: 'הכל', icon: List },
      { key: 'completed', label: 'הושלם ייצור', icon: CheckCircle },
    ],
  };
}

// getCategoryLabel imported from @/utils/categoryLabels

export default function TasksPage() {
  const design = useDesign();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { prevMonthStart, prevMonthEnd, currMonthStart, currMonthEnd, tabs: TIME_TABS } = useMemo(() => getTimePeriods(), []);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [view, setView] = useState("kanban");
  const [isClearing, setIsClearing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [clientMap, setClientMap] = useState({});
  const [clientsList, setClientsList] = useState([]);
  const [timeTab, setTimeTab] = useState('active');
  const [contextFilter, setContextFilter] = useState('all');
  const [sortField, setSortField] = useState('due_date');
  const [groupBy, setGroupBy] = useState('status'); // 'status' or 'category'
  const [collapsedStatuses, setCollapsedStatuses] = useState(() => {
    const init = {};
    DEFAULT_COLLAPSED_STATUSES.forEach(s => { init[s] = true; });
    return init;
  });

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showInjectionPanel, setShowInjectionPanel] = useState(false);
  const [ghostCleanup, setGhostCleanup] = useState(null); // { loading, result }

  const runGhostScan = async () => {
    setGhostCleanup({ loading: true, result: null });
    const res = await cleanupGhostTasks({ dryRun: true });
    setGhostCleanup({ loading: false, result: res.data });
  };

  const runGhostDelete = async () => {
    setGhostCleanup(prev => ({ ...prev, loading: true }));
    const res = await cleanupGhostTasks({ dryRun: false });
    setGhostCleanup({ loading: false, result: res.data });
    loadTasks(); // Refresh
  };
  const [listSubTaskParent, setListSubTaskParent] = useState(null);
  const [collapsedParents, setCollapsedParents] = useState({});

  // ── Bulk Update Mode ──
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleGroupSelection = (taskIds) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      const allSelected = taskIds.every(id => next.has(id));
      if (allSelected) {
        taskIds.forEach(id => next.delete(id));
      } else {
        taskIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTaskIds.size === 0) return;
    try {
      const promises = [...selectedTaskIds].map(id =>
        updateTaskWithCascade(id, { status: newStatus })
      );
      await Promise.all(promises);
      selectedTaskIds.forEach(id => syncNotesWithTaskStatus(id, newStatus));
      setSelectedTaskIds(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error("Bulk status update error:", error);
      loadTasks();
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedTaskIds(new Set());
  };

  // ── Cascade Engine Hook — ensures status changes trigger Phase B/C task creation ──
  const { updateTaskWithCascade, updateStepWithCascade } = useTaskCascade(tasks, setTasks, clientsList);

  const toggleStatusGroup = (status) => {
    setCollapsedStatuses(prev => ({ ...prev, [status]: !prev[status] }));
  };
  const toggleCategoryGroup = (key) => {
    setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const expandAllGroups = () => { setCollapsedStatuses({}); setCollapsedCategories({}); };
  const collapseAllGroups = () => {
    const statusKeys = {};
    STATUS_GROUP_ORDER.forEach(s => { statusKeys[s] = true; });
    setCollapsedStatuses(statusKeys);
    collapseAllCategories();
  };
  const expandAllCategories = () => setCollapsedCategories({});
  const collapseAllCategories = () => {
    const allKeys = {};
    groupedTasks.forEach(({ key: groupKey, tasks: groupTasks }) => {
      const cats = new Set();
      groupTasks.forEach(t => cats.add(getCategoryLabel(t.category)));
      if (cats.size > 1) {
        cats.forEach(cat => { allKeys[`${groupKey}_${cat}`] = true; });
      }
    });
    setCollapsedCategories(allKeys);
  };
  const toggleParentCollapse = (taskId) => {
    setCollapsedParents(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };
  const [sortDir, setSortDir] = useState('asc');

  const location = useLocation();
  const navigate = useNavigate();

  // Feature 8: Deep-link from search — focus specific task/client in MindMap
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [focusClientName, setFocusClientName] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const priorityParam = params.get('priority');
    const tabParam = params.get('tab');
    const contextParam = params.get('context');
    const viewParam = params.get('view');
    const taskIdParam = params.get('taskId');
    const clientNameParam = params.get('clientName');
    if (statusParam) setStatusFilter([statusParam]);
    if (priorityParam) setPriorityFilter(priorityParam);
    if (tabParam && ['prev_month', 'curr_month', 'active', 'completed', 'all'].includes(tabParam)) {
      setTimeTab(tabParam);
    }
    if (contextParam && ['work', 'home'].includes(contextParam)) {
      setContextFilter(contextParam);
    }
    // Feature 8: Auto-switch to mindmap and focus on client/task
    if (viewParam === 'mindmap') setView('mindmap');
    if (taskIdParam) setFocusTaskId(taskIdParam);
    if (clientNameParam) setFocusClientName(decodeURIComponent(clientNameParam));
  }, [location.search]);

  useEffect(() => { loadTasks(); loadClients(); }, []);

  const loadClients = async () => {
    try {
      const clients = await Client.list(null, 500);
      const arr = Array.isArray(clients) ? clients : [];
      setClientsList(arr);
      const map = {};
      arr.forEach(c => { if (c.name) map[c.name] = c.id; });
      setClientMap(map);
    } catch { setClientMap({}); setClientsList([]); }
  };

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const rawTasks = await Task.list(null, 5000).catch(() => []);
      const validTasks = Array.isArray(rawTasks) ? rawTasks : [];

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
          return task.status !== 'production_completed';
        case 'completed':
          return task.status === 'production_completed';
        case 'all':
        default:
          return true;
      }
    });
  }, [tasks, timeTab]);

  // Search + status + priority + category + context filtering
  const filteredTasks = useMemo(() => {
    let result = [...timeFilteredTasks];

    if (contextFilter !== 'all') {
      result = result.filter(t => getTaskContext(t) === contextFilter);
    }
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
  }, [timeFilteredTasks, searchTerm, statusFilter, priorityFilter, categoryFilter, contextFilter]);

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
          const statusOrder = ['waiting_for_materials','not_started','sent_for_review','needs_corrections','production_completed'];
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

  // P-branch colors — dynamic from Design Engine (CSS variable: --cp-p1 etc.)
  const getBranchDotStyle = (branch) => ({
    backgroundColor: design.getBranchColor(branch),
  });

  // Group sorted tasks by status, category, client, or p_branch
  const groupedTasks = useMemo(() => {
    if (groupBy === 'category') {
      const groups = {};
      sortedTasks.forEach(task => {
        const cat = task.category || '__none__';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(task);
      });
      const catKeys = Object.keys(groups).sort((a, b) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'he');
      });
      return catKeys.map(cat => ({
        key: cat,
        label: cat === '__none__' ? 'ללא קטגוריה' : getCategoryLabel(cat),
        dot: 'bg-gray-400',
        tasks: groups[cat],
      }));
    }
    if (groupBy === 'client') {
      const groups = {};
      sortedTasks.forEach(task => {
        const client = task.client_name || '__no_client__';
        if (!groups[client]) groups[client] = [];
        groups[client].push(task);
      });
      const clientKeys = Object.keys(groups).sort((a, b) => {
        if (a === '__no_client__') return 1;
        if (b === '__no_client__') return -1;
        return a.localeCompare(b, 'he');
      });
      return clientKeys.map(client => ({
        key: client,
        label: client === '__no_client__' ? 'ללא לקוח' : client,
        dot: 'bg-sky-500',
        tasks: groups[client],
      }));
    }
    if (groupBy === 'p_branch') {
      const groups = {};
      sortedTasks.forEach(task => {
        const branch = getTaskPBranch(task) || '__none__';
        if (!groups[branch]) groups[branch] = [];
        groups[branch].push(task);
      });
      const branchOrder = ['P1', 'P2', 'P3', 'P4', 'P5', '__none__'];
      return branchOrder
        .filter(b => groups[b] && groups[b].length > 0)
        .map(b => ({
          key: b,
          label: b === '__none__' ? 'לא משויך' : getPBranchLabel(b),
          dotStyle: b !== '__none__' ? getBranchDotStyle(b) : null,
          dot: 'bg-gray-400',
          tasks: groups[b],
        }));
    }
    // Default: group by status
    const groups = {};
    sortedTasks.forEach(task => {
      const s = task.status || 'not_started';
      if (!groups[s]) groups[s] = [];
      groups[s].push(task);
    });
    return STATUS_GROUP_ORDER
      .filter(s => groups[s] && groups[s].length > 0)
      .map(s => {
        const cfg = statusConfig[s] || statusConfig.not_started;
        return { key: s, label: cfg.text, dot: cfg.dot, tasks: groups[s] };
      });
  }, [sortedTasks, groupBy]);

  // Build a map of parent_id -> children for hierarchical rendering
  const childrenMap = useMemo(() => {
    const map = {};
    sortedTasks.forEach(task => {
      if (task.parent_id) {
        if (!map[task.parent_id]) map[task.parent_id] = [];
        map[task.parent_id].push(task);
      }
    });
    return map;
  }, [sortedTasks]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'production_completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'sent_for_review' || t.status === 'needs_corrections').length;
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
      // Use cascade engine so status changes trigger Phase B/C task creation
      await updateTaskWithCascade(task.id, { status: newStatus });
      syncNotesWithTaskStatus(task.id, newStatus);
    } catch (error) {
      console.error("Error updating status:", error);
      loadTasks();
    }
  };

  const handleDeleteTask = async (taskId) => {
    const ok = await confirm({ description: 'למחוק משימה זו?' });
    if (ok) {
      try {
        await Task.delete(taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleEditTask = (task) => setEditingTask(task);

  const handleSaveTask = async (updatedData) => {
    try {
      // Track reschedule if due_date changed
      if (updatedData.due_date && editingTask.due_date && updatedData.due_date !== editingTask.due_date) {
        updatedData.reschedule_count = (editingTask.reschedule_count || 0) + 1;
      }
      // Use cascade engine so editing a task's status triggers downstream tasks
      await updateTaskWithCascade(editingTask.id, updatedData);
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleClearAllTasks = async () => {
    const count = tasks.length;
    const ok = await confirm({
      title: 'מחיקת כל המשימות',
      description: `למחוק את כל ${count} המשימות? פעולה בלתי הפיכה!`,
      confirmText: 'מחק הכל',
      delayMs: 3000,
    });
    if (!ok) return;
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
        className="px-3 py-2.5 text-end text-xs font-bold text-[#37474F] cursor-pointer hover:bg-[#F0F0F0] select-none whitespace-nowrap bg-[#FAFBFC]"
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
      <div className="space-y-6 p-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full dark:bg-gray-900 dark:text-white">
      {ConfirmDialogComponent}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">כל המשימות</h1>
            {contextFilter !== 'all' && (
              <Badge className={`text-sm px-2.5 py-1 gap-1.5 ${contextFilter === 'work' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {contextFilter === 'work' ? <Briefcase className="w-3.5 h-3.5" /> : <HomeIcon className="w-3.5 h-3.5" />}
                {contextFilter === 'work' ? 'עבודה' : 'בית'}
                <Button variant="ghost" size="sm" onClick={() => setContextFilter('all')} className="hover:bg-[#F5F5F5] rounded-full p-0.5 me-0.5 h-auto">
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            )}
          </div>
          <p className="text-base text-slate-600 font-medium mt-1">
            {stats.total} משימות | {stats.completed} הושלמו | {stats.inProgress} בעבודה
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowInjectionPanel(prev => !prev)}
            className={`gap-1 rounded-xl ${showInjectionPanel ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
          >
            <GitBranchPlus className="w-4 h-4" />
            הזרקת משימות
          </Button>
          <Button
            size="sm"
            onClick={runGhostScan}
            variant="outline"
            className="gap-1 rounded-xl text-red-600 border-red-200 hover:bg-red-50"
            disabled={ghostCleanup?.loading}
          >
            <Trash2 className="w-4 h-4" />
            ניקוי רפאים
          </Button>
          <Button size="sm" onClick={() => setShowQuickAdd(true)} className="gap-1 rounded-xl">
            <Plus className="w-4 h-4" />
            משימה מהירה
          </Button>
          <Button variant="ghost" size="sm" onClick={loadTasks} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Ghost Cleanup Result Panel ── */}
      {ghostCleanup?.result && (
        <Card className="border-red-200 bg-red-50/30 shadow-sm">
          <CardContent className="p-4" dir="rtl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-red-800">
                סריקת רפאים — {ghostCleanup.result.dryRun ? 'תצוגה מקדימה' : 'הושלם'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setGhostCleanup(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-lg font-bold">{ghostCleanup.result.totalTasks}</div>
                <div className="text-xs text-gray-500">סה"כ משימות</div>
              </div>
              <div className="text-center p-2 bg-red-100 rounded-lg">
                <div className="text-lg font-bold text-red-700">{ghostCleanup.result.ghostCount}</div>
                <div className="text-xs text-red-600">רפאים שזוהו</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-lg font-bold">{ghostCleanup.result.deletedCount || 0}</div>
                <div className="text-xs text-gray-500">נמחקו</div>
              </div>
            </div>
            {ghostCleanup.result.ghostsByCategory && Object.keys(ghostCleanup.result.ghostsByCategory).length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-gray-600 mb-1">לפי קטגוריה:</div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ghostCleanup.result.ghostsByCategory).map(([cat, count]) => (
                    <Badge key={cat} variant="outline" className="text-red-600 border-red-300">
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {ghostCleanup.result.ghostCount > 0 && ghostCleanup.result.dryRun && (
              <Button
                size="sm"
                onClick={runGhostDelete}
                className="bg-red-600 hover:bg-red-700 text-white gap-1"
                disabled={ghostCleanup.loading}
              >
                <Trash2 className="w-4 h-4" />
                {ghostCleanup.loading ? 'מוחק...' : `מחק ${ghostCleanup.result.ghostCount} רפאים`}
              </Button>
            )}
            {ghostCleanup.result.ghostCount === 0 && (
              <p className="text-sm text-green-700 font-medium">לא נמצאו רפאים — הכל נקי!</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Manual Task Injection Panel (collapsible) ── */}
      <AnimatePresence>
        {showInjectionPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <Card className="border-orange-200 bg-orange-50/30 shadow-sm">
              <CardContent className="p-4">
                <ClientRecurringTasks onGenerateComplete={loadTasks} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time Period Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TIME_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = timeTab === tab.key;
          const contextTasks = contextFilter !== 'all'
            ? tasks.filter(t => getTaskContext(t) === contextFilter)
            : tasks;
          const count = contextTasks.filter(t => {
            const d = t.due_date ? parseISO(t.due_date) : null;
            switch (tab.key) {
              case 'prev_month': return d && d >= prevMonthStart && d <= prevMonthEnd;
              case 'curr_month': return d && d >= currMonthStart && d <= currMonthEnd;
              case 'active': return t.status !== 'production_completed';
              case 'completed': return t.status === 'production_completed';
              case 'all': return true;
              default: return true;
            }
          }).length;
          return (
            <Button
              variant={isActive ? 'default' : 'outline'}
              key={tab.key}
              onClick={() => setTimeTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border h-auto ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <Badge className={`text-[12px] px-1.5 py-0 h-4 min-w-[20px] ${isActive ? 'bg-[#F5F5F5] text-white' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="חיפוש לפי שם משימה, לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pe-10 rounded-xl"
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

      {/* View Toggle: list / kanban / mindmap / gantt */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">תצוגה:</span>
        <div className="flex bg-white rounded-lg p-0.5 shadow-sm border text-xs">
          {[
            { key: 'kanban', label: 'קנבן', icon: LayoutGrid },
            { key: 'list', label: 'רשימה', icon: List },
            { key: 'mindmap', label: 'מיינדמפ', icon: Network },
            { key: 'gantt', label: 'גאנט', icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <Button
              variant="ghost"
              size="sm"
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors h-auto ${
                view === key ? 'bg-primary/10 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Group by toggle for list view */}
      {view === 'list' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">קיבוץ לפי:</span>
          <div className="flex bg-white rounded-lg p-0.5 shadow-sm border text-xs">
            {[
              { key: 'status', label: 'סטטוס' },
              { key: 'category', label: 'סוג דיווח' },
              { key: 'client', label: 'לקוח' },
              { key: 'p_branch', label: 'ענף (P1-P5)' },
            ].map(opt => (
              <Button
                variant="ghost"
                size="sm"
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors h-auto ${groupBy === opt.key ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex bg-white rounded-lg p-0.5 shadow-sm border text-xs me-2">
            <Button variant="ghost" size="sm" onClick={expandAllGroups} className="px-2.5 py-1.5 rounded-md text-[#000000] hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors h-auto">
              הרחב הכל
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAllGroups} className="px-2.5 py-1.5 rounded-md text-[#000000] hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors h-auto">
              כווץ הכל
            </Button>
          </div>
        </div>
      )}

      {/* Bulk update toggle — available in all views */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 h-auto ${
            bulkMode
              ? 'bg-violet-100 text-violet-700 border-violet-400'
              : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
          }`}
        >
          {bulkMode ? `ביטול (${selectedTaskIds.size} נבחרו)` : 'עדכון מרובה'}
        </Button>
        {bulkMode && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allIds = filteredTasks.map(t => t.id);
                setSelectedTaskIds(new Set(allIds));
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-colors h-auto"
            >
              בחר הכל ({filteredTasks.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTaskIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors h-auto"
            >
              נקה בחירה
            </Button>
          </>
        )}
      </div>

      {/* Bulk action floating bar */}
      <AnimatePresence>
        {bulkMode && selectedTaskIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border-2 border-violet-300"
            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-sm font-black text-violet-700">{selectedTaskIds.size} נבחרו</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-bold text-gray-500">שנה סטטוס:</span>
            {Object.entries(statusConfig).map(([key, { text, dot }]) => (
              <Button
                variant="ghost"
                size="sm"
                key={key}
                onClick={() => handleBulkStatusChange(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-transparent hover:border-violet-300 transition-all hover:shadow-sm h-auto"
                style={{ background: 'rgba(255,255,255,0.8)' }}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                {text}
              </Button>
            ))}
            <span className="text-gray-300">|</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitBulkMode}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors h-auto"
            >
              <X className="w-4 h-4 text-gray-400" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <ViewErrorBoundary>
      {view === 'list' ? (
        sortedTasks.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-slate-500 text-lg font-medium">אין משימות להצגה</p>
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
                  {bulkMode && (
                    <th className="px-2 py-2.5 bg-[#FAFBFC] w-8" />
                  )}
                  <SortHeader field="client_name">לקוח</SortHeader>
                  <SortHeader field="category">סוג דיווח</SortHeader>
                  <th className="px-3 py-2.5 text-end text-xs font-bold text-[#37474F] bg-[#FAFBFC]">תיאור</th>
                  <SortHeader field="due_date">תאריך יעד</SortHeader>
                  <SortHeader field="status">סטטוס</SortHeader>
                  <SortHeader field="priority">עדיפות</SortHeader>
                  <th className="px-3 py-2.5 text-end text-xs font-bold text-[#37474F] bg-[#FAFBFC] w-10"></th>
                </tr>
              </thead>
              <tbody>
                {groupedTasks.map(({ key: groupKey, label: groupLabel, dot: groupDot, dotStyle: groupDotStyle, tasks: groupTasks }) => {
                  const isGroupCollapsed = !!collapsedStatuses[groupKey];
                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group header row */}
                      <tr
                        className="cursor-pointer select-none hover:bg-[#F0F0F0] transition-colors bg-[#FAFBFC]"
                        onClick={() => toggleStatusGroup(groupKey)}
                      >
                        <td colSpan={bulkMode ? 8 : 7} className="py-2 px-3 border-b border-gray-100">
                          <div className="flex items-center gap-2.5">
                            {bulkMode && (
                              <input
                                type="checkbox"
                                checked={groupTasks.length > 0 && groupTasks.every(t => selectedTaskIds.has(t.id))}
                                onChange={(e) => { e.stopPropagation(); toggleGroupSelection(groupTasks.map(t => t.id)); }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-violet-300 text-violet-600 accent-violet-600 shrink-0"
                              />
                            )}
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isGroupCollapsed ? 'rotate-[-90deg]' : ''}`} />
                            <div className={`w-2.5 h-2.5 rounded-full ${groupDotStyle ? '' : groupDot} shrink-0`} style={groupDotStyle || undefined} />
                            <span className="font-semibold text-gray-700 text-xs">{groupLabel}</span>
                            <Badge variant="secondary" className="text-[12px] px-1.5 py-0 bg-gray-100 text-gray-500 font-normal">
                              {groupTasks.length}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                      {/* Task rows - grouped by category */}
                      {!isGroupCollapsed && (() => {
                        // Group tasks by category
                        const catGroups = {};
                        groupTasks.forEach(t => {
                          const cat = getCategoryLabel(t.category);
                          if (!catGroups[cat]) catGroups[cat] = [];
                          catGroups[cat].push(t);
                        });
                        const catEntries = Object.entries(catGroups).sort((a, b) => b[1].length - a[1].length);
                        const showCatHeaders = catEntries.length > 1;

                        return catEntries.map(([cat, catTasks]) => {
                          const catKey = `${groupKey}_${cat}`;
                          const isCatCollapsed = !!collapsedCategories[catKey];
                          return (
                            <React.Fragment key={catKey}>
                              {showCatHeaders && (
                                <tr
                                  className="cursor-pointer select-none hover:bg-[#F5F5F5] transition-colors"
                                  onClick={() => toggleCategoryGroup(catKey)}
                                >
                                  <td colSpan={7} className="py-1.5 px-6 border-b border-gray-50">
                                    <div className="flex items-center gap-2">
                                      <ChevronDown className={`w-3 h-3 text-gray-300 transition-transform ${isCatCollapsed ? 'rotate-[-90deg]' : ''}`} />
                                      <span className="text-[11px] font-semibold text-gray-500">{cat}</span>
                                      <span className="text-[12px] text-gray-400">({catTasks.length})</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {(!showCatHeaders || !isCatCollapsed) && (() => {
                    // Hierarchical rendering: show roots first, then nest children
                    const rootTasks = catTasks.filter(t => !t.parent_id || !catTasks.some(ct => ct.id === t.parent_id));

                    const renderTaskRow = (task, depth = 0) => {
                      const sts = statusConfig[task.status] || statusConfig.not_started;
                      const pri = priorityConfig[task.priority] || priorityConfig.medium;
                      const isCompleted = task.status === 'completed';
                      const children = childrenMap[task.id] || [];
                      const hasChildren = children.length > 0;
                      const isParentCollapsed = !!collapsedParents[task.id];
                      const indentPx = depth * 24;

                      return (
                        <React.Fragment key={task.id}>
                          <tr
                            className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isCompleted ? 'opacity-50' : ''} ${bulkMode && selectedTaskIds.has(task.id) ? 'bg-violet-50' : ''}`}
                          >
                            {/* Bulk checkbox */}
                            {bulkMode && (
                              <td className="px-2 py-2 w-8">
                                <input
                                  type="checkbox"
                                  checked={selectedTaskIds.has(task.id)}
                                  onChange={() => toggleTaskSelection(task.id)}
                                  className="w-4 h-4 rounded border-violet-300 text-violet-600 accent-violet-600"
                                />
                              </td>
                            )}
                            {/* Client */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5" style={{ paddingInlineStart: `${indentPx}px` }}>
                                {hasChildren && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleParentCollapse(task.id)}
                                    className="p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0 h-auto"
                                  >
                                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isParentCollapsed ? 'rotate-[-90deg]' : ''}`} />
                                  </Button>
                                )}
                                {depth > 0 && !hasChildren && (
                                  <span className="w-4 shrink-0" />
                                )}
                                <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">
                                  {task.client_name || '-'}
                                </span>
                                {clientMap[task.client_name] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/ClientManagement?clientId=${clientMap[task.client_name]}`)}
                                    className="p-0.5 rounded hover:bg-primary/10 transition-colors shrink-0 h-auto"
                                    title="פתח כרטיס לקוח"
                                  >
                                    <ExternalLink className="w-3 h-3 text-primary" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            {/* Category */}
                            <td className="px-3 py-2">
                              {task.category ? (
                                <Badge variant="outline" className="text-[12px] px-2 py-0.5">
                                  {getCategoryLabel(task.category)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </td>
                            {/* Title / description */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                {depth > 0 && (
                                  <GitBranchPlus className="w-3 h-3 text-violet-400 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate max-w-[250px] ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-[12px] text-gray-400 truncate max-w-[250px]">
                                      {task.description.slice(0, 50)}
                                    </p>
                                  )}
                                </div>
                              </div>
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
                                <SelectTrigger className="w-28 h-7 rounded-lg text-[12px] border-0 bg-gray-50">
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
                              <Badge className={`text-[12px] px-2 py-0.5 ${pri.color}`}>
                                {pri.text}
                              </Badge>
                            </td>
                            {/* Actions */}
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-0.5">
                                {depth < 4 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setListSubTaskParent(task)}
                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors h-auto"
                                    title="הוסף תת-משימה"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTask(task)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors h-auto"
                                  title="עריכת משימה"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors h-auto"
                                  title="מחק משימה"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setNoteTask(task)}
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors h-auto"
                                  title="הוסף לפתק דביק"
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {/* Render children recursively */}
                          {hasChildren && !isParentCollapsed && children.map(child => renderTaskRow(child, depth + 1))}
                        </React.Fragment>
                      );
                    };

                    return rootTasks.map(task => renderTaskRow(task, 0));
                  })()}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </ResizableTable>
          </Card>
        )
      ) : view === 'mindmap' ? (
        <ViewErrorBoundary>
          <MindMapView tasks={filteredTasks} clients={clientsList} onEditTask={handleEditTask} onTaskCreated={loadTasks} onStatusChange={handleStatusChange} focusTaskId={focusTaskId} focusClientName={focusClientName} onFocusHandled={() => { setFocusTaskId(null); setFocusClientName(null); }} />
        </ViewErrorBoundary>
      ) : view === 'gantt' ? (
        <GanttView tasks={filteredTasks} clients={clientsList} onEditTask={handleEditTask} />
      ) : (
        <KanbanView
          tasks={filteredTasks}
          onTaskStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
          onEditTask={handleEditTask}
          formatDate={formatDate}
          getPriorityColor={(p) => priorityConfig[p]?.color || priorityConfig.medium.color}
          getStatusColor={(s) => statusConfig[s]?.color || statusConfig.not_started.color}
          getStatusText={(s) => statusConfig[s]?.text || s}
          getPriorityText={(p) => priorityConfig[p]?.text || p}
          clients={clientsList}
          onTaskCreated={loadTasks}
          bulkMode={bulkMode}
          selectedTaskIds={selectedTaskIds}
          onToggleTaskSelection={toggleTaskSelection}
        />
      )}
      </ViewErrorBoundary>

      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={loadTasks}
      />

      {/* Sub-task creation dialog from list view */}
      <QuickAddTaskDialog
        open={!!listSubTaskParent}
        onOpenChange={(val) => { if (!val) setListSubTaskParent(null); }}
        defaultParentId={listSubTaskParent?.id || null}
        defaultClientId={listSubTaskParent?.client_id || null}
        lockedParent={true}
        lockedClient={!!listSubTaskParent?.client_id}
        onCreated={() => {
          setListSubTaskParent(null);
          loadTasks();
        }}
      />

      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={(task) => { setEditingTask(null); handleDeleteTask(task.id); }}
        allTasks={tasks}
        onTaskCreated={loadTasks}
      />

      <TaskToNoteDialog
        task={noteTask}
        open={!!noteTask}
        onClose={() => setNoteTask(null)}
      />

      {/* Bottom: clear all */}
      {tasks.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllTasks}
            disabled={isClearing}
            className="text-xs text-gray-400 hover:text-amber-500"
          >
            <Trash2 className="w-3 h-3 ms-1" />
            {isClearing ? 'מוחק...' : 'מחק הכל'}
          </Button>
        </div>
      )}
    </div>
  );
}
