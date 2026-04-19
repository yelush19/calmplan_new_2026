
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Client, Task } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader, RefreshCw, Users, Search,
  ChevronLeft, ChevronRight,
  ExternalLink, Calculator, Briefcase, Settings2,
  Plus, Check, X, ArrowLeft
} from 'lucide-react';
import MultiStatusFilter from '@/components/ui/MultiStatusFilter';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { isBimonthlyOffMonth, STATUS_CONFIG, getServiceForTask, ALL_SERVICES, getTaskProcessSteps } from '@/config/processTemplates';
import { getTaskReportingMonth } from '@/config/automationRules';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import { processTaskCascade, PHASE_B_SERVICES, PHASE_C_SERVICES, P2_PHASE_B_SERVICES, P2_PHASE_C_SERVICES } from '@/engines/taskCascadeEngine';


// === Column Groups — P2 ONLY: Tax + Bookkeeping services ===
// Payroll columns (שכר, ביט"ל, ניכויים) belong to P1 (PayrollDashboard).
const COLUMN_GROUPS = [
  {
    key: 'taxes',
    label: 'מיסים',
    bgColor: 'bg-[#4682B4]/5',
    headerBg: 'bg-[#4682B4]',
    headerText: 'text-white',
    drillDownPage: 'ClientsDashboard',
    icon: Calculator,
    columns: [
      { key: 'vat', label: 'מע"מ', categories: ['מע"מ', 'מע"מ 874', 'work_vat_reporting'], createCategory: 'מע"מ', createTitle: 'מע"מ', requiredServices: ['vat_reporting', 'bookkeeping', 'full_service'] },
      { key: 'tax_advances', label: 'מקדמות מ"ה', categories: ['מקדמות מס', 'work_tax_advances'], createCategory: 'מקדמות מס', createTitle: 'מקדמות מס הכנסה', requiredServices: ['tax_advances', 'bookkeeping', 'full_service', 'tax_reports'] },
    ],
  },
  {
    key: 'p2_additional',
    label: 'שירותי הנה"ח נוספים',
    bgColor: 'bg-indigo-50',
    headerBg: 'bg-indigo-600',
    headerText: 'text-white',
    drillDownPage: 'BookkeepingExtrasDashboard',
    icon: Settings2,
    serviceCheck: true,
    columns: [
      { key: 'masav_suppliers', label: 'מס"ב ספקים', categories: ['מס"ב ספקים'], createCategory: 'מס"ב ספקים', createTitle: 'מס"ב ספקים', service: 'masav_suppliers' },
      { key: 'operator_reporting', label: 'מתפעל', categories: ['דיווח למתפעל', 'מתפעל', 'work_operator_reporting'], createCategory: 'דיווח למתפעל', createTitle: 'דיווח למתפעל', service: 'operator_reporting' },
      { key: 'taml_reporting', label: 'טמל', categories: ['דיווח לטמל', 'טמל + לקוח', 'work_taml_reporting'], createCategory: 'דיווח לטמל', createTitle: 'דיווח לטמל', service: 'taml_reporting' },
      { key: 'consulting', label: 'ייעוץ', categories: ['ייעוץ', 'work_consulting'], createCategory: 'ייעוץ', createTitle: 'ייעוץ', service: 'consulting' },
    ],
  },
];

const ALL_COLUMNS = COLUMN_GROUPS.flatMap(g => g.columns);

// Statuses available for quick-change (excluding 'issues' duplicate)
const CHANGEABLE_STATUSES = Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'issues');

const EMPTY_STATUS = { label: '-', bg: 'bg-white', text: 'text-slate-300' };

// Popover positioned near a cell
function CellPopover({ anchorRect, onClose, children }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  const top = anchorRect.bottom + 4;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 220));

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-[#E0E0E0] p-2 min-w-[200px] animate-in fade-in-0 zoom-in-95"
      style={{ top, left }}
    >
      {children}
    </div>
  );
}

export default function ClientsDashboardPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1)); // Default to reporting month (previous)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  // Smart pagination — 15 clients visible by default (ADHD-friendly)
  const CLIENTS_PAGE_SIZE = 15;
  const [visibleClientsCount, setVisibleClientsCount] = useState(CLIENTS_PAGE_SIZE);

  // Column visibility — users can hide columns they don't need
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('p2-hidden-columns');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Column widths — resizable (min 60px, stored in localStorage)
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('p2-column-widths');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleColumnVisibility = useCallback((colKey) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(colKey)) next.delete(colKey); else next.add(colKey);
      localStorage.setItem('p2-hidden-columns', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Resize handler for column drag
  const resizeRef = useRef(null);
  const handleResizeStart = useCallback((colKey, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || 80;
    const onMove = (moveE) => {
      const delta = moveE.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setColumnWidths(prev => {
        const next = { ...prev, [colKey]: newWidth };
        localStorage.setItem('p2-column-widths', JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [columnWidths]);

  // Filter out hidden columns from groups
  const visibleColumnGroups = useMemo(() => {
    return COLUMN_GROUPS.map(group => ({
      ...group,
      columns: group.columns.filter(col => !hiddenColumns.has(col.key)),
    })).filter(group => group.columns.length > 0);
  }, [hiddenColumns]);

  const visibleAllColumns = useMemo(() => visibleColumnGroups.flatMap(g => g.columns), [visibleColumnGroups]);

  // Popover state for inline editing
  const [popover, setPopover] = useState(null); // { anchorRect, clientName, clientId, colKey, group, task }
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => { loadData(); }, [selectedMonth]);

  // Reset pagination when filters/search/month change
  useEffect(() => {
    setVisibleClientsCount(CLIENTS_PAGE_SIZE);
  }, [searchTerm, statusFilter, selectedMonth]);

  // Cross-page sync: re-fetch when other pages update tasks
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Due dates are in the DEADLINE month (month after reporting period)
      const deadlineMonth = addMonths(selectedMonth, 1);
      const start = startOfMonth(deadlineMonth);
      const end = endOfMonth(deadlineMonth);
      const reportStart = startOfMonth(selectedMonth);

      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.list(null, 5000).catch(() => []),
      ]);

      setClients(
        (clientsData || [])
          .filter(c => c.status === 'active' || c.status === 'balance_sheet_only' || c.status === 'onboarding_pending')
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
      );
      // Post-filter: only show tasks belonging to the selected reporting month
      const allRaw = Array.isArray(tasksData) ? tasksData : [];
      const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
      const filteredTasks = allRaw.filter(t => {
        return getTaskReportingMonth(t) === selectedMonthStr;
      });
      // DATA SURVIVAL: if month filter kills everything, show all tasks
      setTasks(filteredTasks.length > 0 ? filteredTasks : allRaw);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setIsLoading(false);
  };

  // Build client -> column -> tasks lookup
  const clientDataMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const clientName = task.client_name;
      if (!clientName) return;
      for (const col of ALL_COLUMNS) {
        if (col.categories && col.categories.includes(task.category)) {
          if (!map[clientName]) map[clientName] = {};
          if (!map[clientName][col.key]) map[clientName][col.key] = [];
          map[clientName][col.key].push(task);
          break;
        }
      }
    });
    return map;
  }, [tasks]);

  const getCellStatus = (clientName, colKey) => {
    const items = clientDataMap[clientName]?.[colKey];
    if (!items || items.length === 0) return null;
    return items.reduce((best, item) => {
      const bestP = STATUS_CONFIG[best.status]?.priority ?? 99;
      const itemP = STATUS_CONFIG[item.status]?.priority ?? 99;
      return itemP < bestP ? item : best;
    }, items[0]);
  };

  // Check if client needs a specific service column
  const clientNeedsService = (client, col, group) => {
    // Columns with requiredServices (tax columns)
    if (col.requiredServices) {
      return (client.service_types || []).some(st => col.requiredServices.includes(st));
    }
    // Additional services with serviceCheck
    if (group.serviceCheck && col.service) {
      return (client.service_types || []).includes(col.service);
    }
    return true;
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => {
        if (c.name?.toLowerCase().includes(term)) return true;
        if (c.entity_number && String(c.entity_number).toLowerCase().includes(term)) return true;
        // Tax info fields
        const ti = c.tax_info || {};
        const taxFields = [
          ti.tax_id, ti.vat_file_number, ti.tax_deduction_file_number,
          ti.social_security_file_number, ti.income_tax_file_number,
          ti.annual_tax_ids?.deductions_id, ti.annual_tax_ids?.social_security_id,
          ti.annual_tax_ids?.tax_advances_id,
        ];
        if (taxFields.some(v => v && String(v).toLowerCase().includes(term))) return true;
        // Contacts
        if (c.contacts?.some(ct => ct.name?.toLowerCase().includes(term) || ct.email?.toLowerCase().includes(term) || ct.phone?.toLowerCase().includes(term))) return true;
        return false;
      });
    }
    if (statusFilter.length > 0) {
      result = result.filter(client => {
        const data = clientDataMap[client.name] || {};
        const allTasks = Object.values(data).flat();
        const relevant = allTasks;
        const checks = {
          has_issues: relevant.some(t => t.status === 'needs_corrections' || t.status === 'waiting_for_materials'),
          all_done: relevant.length > 0 && relevant.every(t => t.status === 'production_completed'),
          in_progress: relevant.some(t => t.status === 'sent_for_review' || t.status === 'review_after_corrections' || t.status === 'needs_corrections' || t.status === 'ready_to_broadcast' || t.status === 'reported_pending_payment'),
          remaining_completions: relevant.some(t => t.status === 'needs_corrections'),
          not_started: relevant.some(t => t.status === 'not_started') || relevant.length === 0,
        };
        return statusFilter.some(f => checks[f]);
      });
    }
    return result;
  }, [clients, searchTerm, statusFilter, clientDataMap]);

  // Stats
  const stats = useMemo(() => {
    let total = 0, completed = 0, issues = 0, inProgress = 0;
    clients.forEach(client => {
      const data = clientDataMap[client.name] || {};
      ALL_COLUMNS.forEach(col => {
        const items = data[col.key];
        if (items && items.length > 0) {
          const best = getCellStatus(client.name, col.key);
          total++;
          if (best?.status === 'production_completed') completed++;
          else if (best?.status === 'needs_corrections' || best?.status === 'waiting_for_materials') issues++;
          else if (best?.status !== 'not_started') inProgress++;
        }
      });
    });
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, issues, inProgress, pct };
  }, [clients, clientDataMap]);

  const handleMonthChange = (dir) => {
    setSelectedMonth(curr => dir === 'prev' ? subMonths(curr, 1) : addMonths(curr, 1));
  };

  const navigateToDrillDown = (group, clientName) => {
    const url = createPageUrl(group.drillDownPage) + '?client=' + encodeURIComponent(clientName);
    navigate(url);
  };

  // Column completion stats (excludes not_relevant)
  const getColumnStats = (colKey) => {
    let total = 0, done = 0;
    clients.forEach(c => {
      const items = clientDataMap[c.name]?.[colKey];
      if (items && items.length > 0) {
        const best = getCellStatus(c.name, colKey);
        total++;
        if (best?.status === 'production_completed') done++;
      }
    });
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  // === Interactive: open popover on cell click ===
  const handleCellClick = useCallback((e, client, col, group) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const bestTask = getCellStatus(client.name, col.key);
    setPopover({
      anchorRect: rect,
      clientName: client.name,
      clientId: client.id,
      colKey: col.key,
      col,
      group,
      task: bestTask,
    });
  }, [clientDataMap]);

  // === Interactive: update task status ===
  const handleStatusChange = async (newStatus) => {
    if (!popover || isUpdating) return;
    setIsUpdating(true);

    try {
      if (popover.task) {
        const taskObj = popover.task;
        // Run cascade with ORIGINAL task so production_completed guard works correctly
        const steps = getTaskProcessSteps(taskObj);
        const siblings = tasks.filter(t => t.client_name === taskObj.client_name && t.id !== taskObj.id);
        const clientObj = clients.find(c => c.name === taskObj.client_name || c.id === taskObj.client_id);
        const cascade = processTaskCascade(taskObj, steps, siblings, {
          clientServices: clientObj?.service_types || [],
          clientPaymentMethod: clientObj?.authorities_payment_method || '',
          clientReportingInfo: clientObj?.reporting_info || {},
        });
        const finalStatus = cascade.statusUpdate?.status || newStatus;
        await Task.update(taskObj.id, { status: finalStatus });

        // Auto-create cascade child tasks (Phase B/C)
        // This fires when status goes to production_completed
        let tasksToCreate = cascade.tasksToCreate || [];

        // Direct production_completed from dropdown: force create Phase B/C
        if (newStatus === 'production_completed' && taskObj.status !== 'production_completed' && tasksToCreate.length === 0) {
          const service = getServiceForTask(taskObj);
          if (service?.key === 'payroll') {
            const buildChild = (svc, phase) => ({
              title: `${svc.title} - ${taskObj.client_name}`,
              client_name: taskObj.client_name,
              client_id: taskObj.client_id,
              category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title,
              status: 'not_started',
              branch: 'P1',
              due_date: taskObj.due_date,
              report_month: taskObj.report_month,
              context: 'work',
              is_recurring: true,
              workflow_phase: phase,
              master_task_id: taskObj.id,
              triggered_by: taskObj.id,
              source: 'payroll_cascade',
            });
            tasksToCreate = [
              ...PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b')),
              ...PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c')),
            ];
          } else if (service?.key === 'bookkeeping') {
            const existingCats = new Set(siblings.map(t => t.category));
            const buildChild = (svc, phase) => ({
              title: `${svc.title} - ${taskObj.client_name}`,
              client_name: taskObj.client_name,
              client_id: taskObj.client_id,
              category: svc.createCategory || svc.title,
              status: 'not_started',
              branch: 'P2',
              due_date: taskObj.due_date,
              report_month: taskObj.report_month,
              context: 'work',
              is_recurring: true,
              workflow_phase: phase,
              master_task_id: taskObj.id,
              triggered_by: taskObj.id,
              source: 'bookkeeping_cascade',
            });
            tasksToCreate = [
              ...P2_PHASE_B_SERVICES.filter(s => !existingCats.has(s.createCategory)).map(s => buildChild(s, 'phase_b')),
              ...P2_PHASE_C_SERVICES.filter(s => !existingCats.has(s.createCategory)).map(s => buildChild(s, 'phase_c')),
            ];
          }
        }

        // Create child tasks (with duplicate prevention)
        const existingTitles = new Set(tasks.map(t => t.title));
        for (const childDef of tasksToCreate) {
          if (existingTitles.has(childDef.title)) continue;
          await Task.create(childDef);
        }
        syncNotesWithTaskStatus(taskObj.id, finalStatus);
        // Notify other pages
        window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'cascade' } }));
      } else {
        // Create new task - due_date in deadline month (M+1)
        const deadlineEnd = endOfMonth(addMonths(selectedMonth, 1));
        const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: he });
        await Task.create({
          title: `${popover.col.createTitle} - ${popover.clientName} - ${monthLabel}`,
          client_name: popover.clientName,
          client_id: popover.clientId,
          category: popover.col.createCategory,
          status: newStatus,
          due_date: format(deadlineEnd, 'yyyy-MM-dd'),
          reporting_month: format(selectedMonth, 'yyyy-MM'),
        });
      }

      // Refresh tasks without full reload
      const reportStart = startOfMonth(selectedMonth);
      const deadlineMonthEnd = endOfMonth(addMonths(selectedMonth, 1));
      const tasksData = await Task.list(null, 5000).catch(() => []);
      const allRaw = Array.isArray(tasksData) ? tasksData : [];
      const refreshMonthStr = format(selectedMonth, 'yyyy-MM');
      const refreshFiltered = allRaw.filter(t => {
        return getTaskReportingMonth(t) === refreshMonthStr;
      });
      setTasks(refreshFiltered.length > 0 ? refreshFiltered : allRaw);
    } catch (error) {
      console.error('Error updating task:', error);
    }

    setIsUpdating(false);
    setPopover(null);
  };

  // === Interactive: create task for empty cell ===
  const handleCreateTask = async (e, client, col, group) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      anchorRect: rect,
      clientName: client.name,
      clientId: client.id,
      colKey: col.key,
      col,
      group,
      task: null,
    });
  };

  const closePopover = useCallback(() => {
    if (!isUpdating) setPopover(null);
  }, [isUpdating]);

  return (
    <>
    <div className="p-4 md:p-6 space-y-4 bg-white border border-[#E0E0E0] shadow-xl rounded-[32px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">P2 | ריכוז דיווחי מיסים</h1>
            <p className="text-sm text-slate-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | לחץ על תא לשינוי סטטוס</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[12px] text-slate-400 leading-none">חודש דיווח</div>
              <div className="font-semibold text-sm text-slate-700">
                {format(selectedMonth, 'MMMM yyyy', { locale: he })}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-white border-[#E0E0E0] shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{filteredClients.length}</div>
            <div className="text-xs text-slate-500">לקוחות פעילים</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E0E0E0] shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-600">{stats.total}</div>
            <div className="text-xs text-slate-500">תהליכים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-slate-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm hidden md:block">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.issues}</div>
            <div className="text-xs text-slate-500">דורש טיפול</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm hidden md:block">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-xs text-slate-500">התקדמות כוללת</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input placeholder="חיפוש לקוח..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 h-9 text-sm border-[#E0E0E0] bg-white" />
        </div>
        <MultiStatusFilter
          options={[
            { value: 'has_issues', label: 'לבצע תיקונים/השלמות' },
            { value: 'in_progress', label: 'הועבר לעיון' },
            { value: 'not_started', label: 'לבצע' },
            { value: 'all_done', label: 'הושלם ייצור' },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          label="סנן לפי סטטוס"
        />
      </div>

      {/* === THE BOARD === */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader className="w-10 h-10 animate-spin text-emerald-500" />
        </div>
      ) : filteredClients.length > 0 ? (
        <Card className="border-[#E0E0E0] shadow-md overflow-hidden">
          <CardContent className="p-0">
            {/* Column visibility toggle bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-[#E0E0E0] flex-wrap">
              <span className="text-xs font-bold text-slate-500 ms-2">עמודות:</span>
              {ALL_COLUMNS.map(col => (
                <button
                  key={col.key}
                  onClick={() => toggleColumnVisibility(col.key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    hiddenColumns.has(col.key)
                      ? 'bg-slate-200 text-slate-400 line-through'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {col.label}
                </button>
              ))}
              {hiddenColumns.size > 0 && (
                <button
                  onClick={() => { setHiddenColumns(new Set()); localStorage.removeItem('p2-hidden-columns'); }}
                  className="text-xs px-2 py-1 text-emerald-600 hover:text-emerald-800 font-bold"
                >
                  הצג הכל
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[750px]">
                <thead>
                  {/* Group headers */}
                  <tr>
                    <th rowSpan={2} className="text-end px-4 py-3 font-bold text-slate-700 text-sm bg-white sticky right-0 z-20 border-b-2 border-[#E0E0E0] min-w-[160px]">
                      לקוח
                    </th>
                    {visibleColumnGroups.map(group => (
                      <th key={group.key} colSpan={group.columns.length}
                        className={`px-3 py-2.5 text-center font-bold text-sm border-b-2 border-[#E0E0E0] border-x-2 border-[#E0E0E0] ${group.headerBg} ${group.headerText}`}>
                        <Link to={createPageUrl(group.drillDownPage)}
                          className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <group.icon className="w-4 h-4" />
                          {group.label}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      </th>
                    ))}
                  </tr>
                  {/* Sub-column headers — resizable */}
                  <tr className="border-b-2 border-[#E0E0E0]">
                    {visibleColumnGroups.map(group =>
                      group.columns.map((col, idx) => {
                        const colStats = getColumnStats(col.key);
                        const colW = columnWidths[col.key];
                        return (
                          <th key={col.key}
                            className={`px-2 py-2 text-center text-xs font-semibold text-slate-600 ${group.bgColor} ${idx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'} relative select-none`}
                            style={colW ? { width: colW, minWidth: 60 } : { minWidth: 60 }}
                          >
                            <div>{col.label}</div>
                            <div className="text-[12px] font-normal text-slate-400 mt-0.5">{colStats.pct}% ({colStats.done}/{colStats.total})</div>
                            {/* Resize handle */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-400 transition-colors z-10"
                              onMouseDown={(e) => handleResizeStart(col.key, e)}
                            />
                          </th>
                        );
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.slice(0, visibleClientsCount).map((client, index) => {
                    const data = clientDataMap[client.name] || {};
                    const allClientTasks = Object.values(data).flat();
                    const relevantTasks = allClientTasks;
                    const clientDone = relevantTasks.filter(t => t.status === 'production_completed').length;
                    const clientTotal = relevantTasks.length;

                    return (
                      <tr key={client.id}
                        className={`border-b border-[#E0E0E0] transition-colors hover:bg-emerald-50 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F5]'}`}>
                        {/* Client name cell */}
                        <td className="px-4 py-2.5 sticky right-0 z-10 border-l-2 border-[#E0E0E0]"
                          style={{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <Link
                                to={createPageUrl('ClientManagement') + `?clientId=${client.id}`}
                                className="font-semibold text-gray-800 text-sm hover:text-emerald-700 hover:underline transition-colors"
                                title="פתח כרטיס לקוח"
                              >
                                {client.name}
                              </Link>
                              {clientTotal > 0 && (
                                <div className="text-[12px] text-slate-400 mt-0.5">
                                  {clientDone}/{clientTotal} הושלמו
                                </div>
                              )}
                            </div>
                            {clientTotal > 0 && (
                              <div className="w-8 h-8 relative">
                                <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                                  <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                  <circle cx="16" cy="16" r="12" fill="none" stroke="#10b981" strokeWidth="3"
                                    strokeDasharray={`${(clientDone / clientTotal) * 75.4} 75.4`}
                                    strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Process cells */}
                        {visibleColumnGroups.map(group =>
                          group.columns.map((col, colIdx) => {
                            // Service not applicable for this client
                            if (!clientNeedsService(client, col, group)) {
                              return (
                                <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'}`}>
                                  <div className="bg-gray-100 text-slate-400 rounded py-1.5 text-[12px] font-medium mx-0.5">
                                    לא רלוונטי
                                  </div>
                                </td>
                              );
                            }

                            const bestTask = getCellStatus(client.name, col.key);
                            if (!bestTask) {
                              // Check if bimonthly off-month → show "לא רלוונטי"
                              if (isBimonthlyOffMonth(client, col.key, selectedMonth)) {
                                return (
                                  <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'}`}>
                                    <div className="bg-gray-100 text-slate-400 rounded py-1.5 text-xs font-bold mx-0.5">
                                      דו-חודשי
                                    </div>
                                  </td>
                                );
                              }
                              // Empty cell - clickable to create task
                              return (
                                <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'}`}>
                                  <button
                                    onClick={(e) => handleCreateTask(e, client, col, group)}
                                    className="w-full bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded py-1.5 text-xs font-medium mx-0.5 border border-dashed border-[#E0E0E0] hover:border-emerald-300 transition-all cursor-pointer group/empty"
                                    title={`צור משימת ${col.label} עבור ${client.name}`}
                                  >
                                    <span className="group-hover/empty:hidden">-</span>
                                    <Plus className="w-3.5 h-3.5 mx-auto hidden group-hover/empty:block" />
                                  </button>
                                </td>
                              );
                            }

                            const config = STATUS_CONFIG[bestTask.status] || STATUS_CONFIG.not_started;
                            const cellTasks = clientDataMap[client.name]?.[col.key] || [];
                            const isActive = popover?.clientName === client.name && popover?.colKey === col.key;

                            return (
                              <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'}`}>
                                <button
                                  onClick={(e) => handleCellClick(e, client, col, group)}
                                  className={`w-full ${config.bg} text-gray-900 rounded py-1.5 text-xs font-bold mx-0.5 hover:opacity-80 hover:shadow-sm transition-all cursor-pointer ${isActive ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                                  title={`${client.name} - ${col.label}: ${config.label} (לחץ לשינוי סטטוס)`}
                                >
                                  {config.label}
                                  {cellTasks.length > 1 && (
                                    <span className="text-[12px] opacity-70 me-1">({cellTasks.length})</span>
                                  )}
                                </button>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                  {(() => {
                    const remaining = filteredClients.length - visibleClientsCount;
                    const hasMore = remaining > 0;
                    const canCollapse = visibleClientsCount > CLIENTS_PAGE_SIZE && filteredClients.length > CLIENTS_PAGE_SIZE;
                    if (!hasMore && !canCollapse) return null;
                    const nextChunk = Math.min(CLIENTS_PAGE_SIZE, remaining);
                    const totalCols = 1 + visibleColumnGroups.reduce((s, g) => s + g.columns.length, 0);
                    const shown = Math.min(visibleClientsCount, filteredClients.length);
                    return (
                      <tr className="bg-slate-50 border-t border-[#E0E0E0]">
                        <td colSpan={totalCols} className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            <span className="text-xs text-slate-500">
                              מציג {shown} מתוך {filteredClients.length} לקוחות
                            </span>
                            {hasMore && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setVisibleClientsCount(v => v + CLIENTS_PAGE_SIZE)}
                                className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              >
                                <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                                הצג עוד {nextChunk} ({remaining} נוספים)
                              </Button>
                            )}
                            {hasMore && filteredClients.length <= 200 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setVisibleClientsCount(filteredClients.length)}
                                className="text-xs text-slate-500 hover:text-emerald-700"
                              >
                                הצג את כולם
                              </Button>
                            )}
                            {canCollapse && (
                              <button
                                onClick={() => setVisibleClientsCount(CLIENTS_PAGE_SIZE)}
                                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                כווץ חזרה ל-{CLIENTS_PAGE_SIZE}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
                {/* Footer */}
                <tfoot>
                  <tr className="bg-white border-t-2 border-[#E0E0E0]">
                    <td className="px-4 py-2.5 sticky right-0 bg-white z-10 text-sm font-bold text-slate-700 border-l-2 border-[#E0E0E0]">
                      סה"כ ({filteredClients.length} לקוחות)
                    </td>
                    {visibleColumnGroups.map(group =>
                      group.columns.map((col, colIdx) => {
                        const colStats = getColumnStats(col.key);
                        return (
                          <td key={col.key} className={`px-2 py-2.5 text-center ${colIdx === 0 ? 'border-r-2 border-[#E0E0E0]' : 'border-r border-[#E0E0E0]'}`}>
                            <div className="text-sm font-bold text-slate-700">{colStats.pct}%</div>
                            <div className="text-[12px] text-slate-500">{colStats.done}/{colStats.total}</div>
                            <div className="w-full bg-white rounded-full h-1.5 mt-1">
                              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${colStats.pct}%` }} />
                            </div>
                          </td>
                        );
                      })
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center border-[#E0E0E0] shadow-sm">
          <Users className="w-14 h-14 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">אין לקוחות פעילים להצגה</h3>
          <p className="text-sm text-slate-400 mb-4">הוסף לקוחות דרך ניהול לקוחות או שנה סינון</p>
          <Link to={createPageUrl('ClientManagement')}>
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              ניהול לקוחות
            </Button>
          </Link>
        </Card>
      )}

      {/* Status Change Popover */}
      {popover && (
        <CellPopover anchorRect={popover.anchorRect} onClose={closePopover}>
          <div className="space-y-1">
            {/* Header */}
            <div className="px-2 py-1.5 border-b border-gray-100 mb-1">
              <div className="font-semibold text-sm text-gray-800">{popover.clientName}</div>
              <div className="text-xs text-slate-500">{popover.col.label} - {popover.task ? 'שינוי סטטוס' : 'יצירת משימה חדשה'}</div>
            </div>

            {/* Status options */}
            {CHANGEABLE_STATUSES.map(([statusKey, config]) => {
              const isCurrent = popover.task?.status === statusKey;
              return (
                <button
                  key={statusKey}
                  onClick={() => handleStatusChange(statusKey)}
                  disabled={isUpdating}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded text-xs font-bold transition-all
                    ${config.bg} text-gray-900
                    ${isCurrent ? `ring-2 ring-offset-1 ${config.border}` : 'hover:opacity-80'}
                    ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {isCurrent && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className={isCurrent ? '' : 'me-5'}>{config.label}</span>
                </button>
              );
            })}

            {/* Drill-down link */}
            {popover.task && (
              <div className="border-t border-gray-100 pt-1 mt-1">
                <button
                  onClick={() => {
                    navigateToDrillDown(popover.group, popover.clientName);
                    setPopover(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-slate-600 hover:bg-white transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  צפה בפירוט מלא
                </button>
              </div>
            )}
          </div>
        </CellPopover>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visibleColumnGroups.map(group => {
          const Icon = group.icon;
          const groupTasks = tasks.filter(t =>
            group.columns.some(col => col.categories.includes(t.category))
          );
          const groupDone = groupTasks.filter(t => t.status === 'production_completed').length;
          const groupPct = groupTasks.length > 0 ? Math.round((groupDone / groupTasks.length) * 100) : 0;

          return (
            <Link key={group.key} to={createPageUrl(group.drillDownPage)}>
              <Card className="border-[#E0E0E0] hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${group.headerBg} shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">{group.label}</div>
                    <div className="text-xs text-slate-400">
                      {groupDone}/{groupTasks.length} הושלמו
                    </div>
                    <div className="w-full bg-white rounded-full h-1.5 mt-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${groupPct}%` }} />
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        <Link to={createPageUrl('ClientManagement')}>
          <Card className="border-[#E0E0E0] hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#4682B4] shadow-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">ניהול לקוחות</div>
                <div className="text-xs text-slate-400">הוספה, עריכה וצפייה</div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center py-2">
        {CHANGEABLE_STATUSES.map(([key, config]) => (
          <span key={key} className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold ${config.bg} text-gray-900`}>
            {config.label}
          </span>
        ))}
      </div>
    </div>
    </>
  );
}
