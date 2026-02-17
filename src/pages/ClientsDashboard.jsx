
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
import { isBimonthlyOffMonth, STATUS_CONFIG } from '@/config/processTemplates';
import { getTaskReportingMonth } from '@/config/automationRules';

// === Column Groups ===
const COLUMN_GROUPS = [
  {
    key: 'taxes',
    label: 'מיסים',
    bgColor: 'bg-slate-50',
    headerBg: 'bg-slate-600',
    headerText: 'text-white',
    drillDownPage: 'TaxReportsDashboard',
    icon: Calculator,
    columns: [
      { key: 'vat', label: 'מע"מ', categories: ['מע"מ', 'מע"מ 874', 'work_vat_reporting'], createCategory: 'מע"מ', createTitle: 'מע"מ' },
      { key: 'tax_advances', label: 'מקדמות מ"ה', categories: ['מקדמות מס', 'work_tax_advances'], createCategory: 'מקדמות מס', createTitle: 'מקדמות מס הכנסה' },
    ],
  },
  {
    key: 'payroll',
    label: 'שכר',
    bgColor: 'bg-gray-50',
    headerBg: 'bg-gray-600',
    headerText: 'text-white',
    drillDownPage: 'PayrollDashboard',
    icon: Briefcase,
    columns: [
      { key: 'payroll', label: 'שכר', categories: ['שכר', 'work_payroll'], createCategory: 'שכר', createTitle: 'שכר' },
      { key: 'social_security', label: 'ביט"ל', categories: ['ביטוח לאומי', 'work_social_security'], createCategory: 'ביטוח לאומי', createTitle: 'ביטוח לאומי' },
      { key: 'deductions', label: 'ניכויים', categories: ['ניכויים', 'work_deductions'], createCategory: 'ניכויים', createTitle: 'ניכויים' },
    ],
  },
  {
    key: 'additional',
    label: 'שירותים נוספים',
    bgColor: 'bg-indigo-50/50',
    headerBg: 'bg-indigo-600',
    headerText: 'text-white',
    drillDownPage: 'AdditionalServicesDashboard',
    icon: Settings2,
    serviceCheck: true, // columns are only shown if client has the service
    columns: [
      { key: 'masav_social', label: 'מס"ב סוצ\'', categories: ['מס"ב סוציאליות'], createCategory: 'מס"ב סוציאליות', createTitle: 'מס"ב סוציאליות', service: 'masav_social' },
      { key: 'masav_employees', label: 'מס"ב עוב\'', categories: ['מס"ב עובדים'], createCategory: 'מס"ב עובדים', createTitle: 'מס"ב עובדים', service: 'masav_employees' },
      { key: 'payslip_sending', label: 'תלושים', categories: ['משלוח תלושים'], createCategory: 'משלוח תלושים', createTitle: 'משלוח תלושים', service: 'payslip_sending' },
      { key: 'authorities_payment', label: 'רשויות', categories: ['תשלום רשויות'], createCategory: 'תשלום רשויות', createTitle: 'תשלום רשויות', service: 'authorities_payment' },
      { key: 'operator_reporting', label: 'מתפעל', categories: ['דיווח למתפעל'], createCategory: 'דיווח למתפעל', createTitle: 'דיווח למתפעל', service: 'operator_reporting' },
      { key: 'taml_reporting', label: 'טמל', categories: ['דיווח לטמל'], createCategory: 'דיווח לטמל', createTitle: 'דיווח לטמל', service: 'taml_reporting' },
    ],
  },
];

const ALL_COLUMNS = COLUMN_GROUPS.flatMap(g => g.columns);

// Statuses available for quick-change (excluding 'issues' duplicate)
const CHANGEABLE_STATUSES = Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'issues');

const EMPTY_STATUS = { label: '-', bg: 'bg-white', text: 'text-gray-300' };

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
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[200px] animate-in fade-in-0 zoom-in-95"
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

  // Popover state for inline editing
  const [popover, setPopover] = useState(null); // { anchorRect, clientName, clientId, colKey, group, task }
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => { loadData(); }, [selectedMonth]);

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
        Task.filter({
          due_date: { '>=': format(reportStart, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }).catch(() => []),
      ]);

      setClients(
        (clientsData || [])
          .filter(c => c.status === 'active')
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
      );
      // Post-filter: only show tasks belonging to the selected reporting month
      const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
      const filteredTasks = (tasksData || []).filter(t => {
        return getTaskReportingMonth(t) === selectedMonthStr;
      });
      setTasks(filteredTasks);
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

  const hasPayroll = (client) => {
    return client.service_types?.some(st =>
      ['payroll', 'full_service', 'bookkeeping'].includes(st)
    ) || client.reporting_info?.payroll_frequency === 'monthly';
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(term));
    }
    if (statusFilter.length > 0) {
      result = result.filter(client => {
        const data = clientDataMap[client.name] || {};
        const allTasks = Object.values(data).flat();
        const checks = {
          has_issues: allTasks.some(t => t.status === 'issue' || t.status === 'issues' || t.status === 'waiting_for_materials'),
          all_done: allTasks.length > 0 && allTasks.every(t => t.status === 'completed'),
          in_progress: allTasks.some(t => t.status !== 'completed' && t.status !== 'not_started'),
          not_started: allTasks.some(t => t.status === 'not_started') || allTasks.length === 0,
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
          total++;
          const best = getCellStatus(client.name, col.key);
          if (best?.status === 'completed') completed++;
          else if (best?.status === 'issue' || best?.status === 'issues' || best?.status === 'waiting_for_materials') issues++;
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

  // Column completion stats
  const getColumnStats = (colKey) => {
    let total = 0, done = 0;
    clients.forEach(c => {
      const items = clientDataMap[c.name]?.[colKey];
      if (items && items.length > 0) {
        total++;
        const best = getCellStatus(c.name, colKey);
        if (best?.status === 'completed') done++;
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
        // Update existing task
        await Task.update(popover.task.id, { status: newStatus });
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
      const tasksData = await Task.filter({
        due_date: { '>=': format(reportStart, 'yyyy-MM-dd'), '<=': format(deadlineMonthEnd, 'yyyy-MM-dd') },
      }).catch(() => []);
      const refreshMonthStr = format(selectedMonth, 'yyyy-MM');
      const refreshFiltered = (tasksData || []).filter(t => {
        return getTaskReportingMonth(t) === refreshMonthStr;
      });
      setTasks(refreshFiltered);
    } catch (error) {
      console.error('Error updating task:', error);
    }

    setIsUpdating(false);
    setPopover(null);
  };

  // === Bulk: generate all tasks for selected month ===
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);

  const handleBulkGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerateResult(null);

    const end = endOfMonth(selectedMonth);
    const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: he });
    let created = 0, skipped = 0, errors = 0;

    for (const client of clients) {
      for (const group of COLUMN_GROUPS) {
        // Skip payroll columns if client doesn't have payroll service
        const isPayrollGroup = group.key === 'payroll';

        for (const col of group.columns) {
          try {
            // Check if task already exists
            const existing = clientDataMap[client.name]?.[col.key];
            if (existing && existing.length > 0) {
              skipped++;
              continue;
            }

            // Check bimonthly off-month
            const isOffMonth = isBimonthlyOffMonth(client, col.key, selectedMonth);
            const taskStatus = isOffMonth ? 'not_relevant' : 'not_started';

            await Task.create({
              title: `${col.createTitle} - ${client.name} - ${monthLabel}`,
              client_name: client.name,
              client_id: client.id,
              category: col.createCategory,
              status: taskStatus,
              due_date: format(end, 'yyyy-MM-dd'),
            });
            created++;
          } catch (err) {
            console.error(`Error creating task for ${client.name}/${col.key}:`, err);
            errors++;
          }
        }
      }
    }

    // Reload tasks
    await loadData();
    setGenerateResult({ created, skipped, errors });
    setIsGenerating(false);
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
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">תהליכי דיווח חודשיים</h1>
            <p className="text-sm text-gray-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | לחץ על תא לשינוי סטטוס</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[10px] text-gray-400 leading-none">חודש דיווח</div>
              <div className="font-semibold text-sm text-gray-700">
                {format(selectedMonth, 'MMMM yyyy', { locale: he })}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={handleBulkGenerate}
            variant="default"
            size="sm"
            className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            disabled={isLoading || isGenerating || clients.length === 0}
          >
            {isGenerating ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />יוצר...</>
            ) : (
              <><Plus className="w-3.5 h-3.5" />צור דיווחים לכל הלקוחות</>
            )}
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Generation result banner */}
      {generateResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <Check className="w-4 h-4" />
            <span>נוצרו <strong>{generateResult.created}</strong> דיווחים חדשים</span>
            {generateResult.skipped > 0 && <span className="text-gray-500">({generateResult.skipped} כבר קיימים)</span>}
            {generateResult.errors > 0 && <span className="text-red-500">({generateResult.errors} שגיאות)</span>}
          </div>
          <button onClick={() => setGenerateResult(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{filteredClients.length}</div>
            <div className="text-xs text-gray-500">לקוחות פעילים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-xs text-gray-500">תהליכים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm hidden md:block">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.issues}</div>
            <div className="text-xs text-gray-500">דורש טיפול</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm hidden md:block">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-xs text-gray-500">התקדמות כוללת</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="חיפוש לקוח..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 h-9 text-sm border-gray-200 bg-white" />
        </div>
        <MultiStatusFilter
          options={[
            { value: 'has_issues', label: 'דורש טיפול' },
            { value: 'in_progress', label: 'בעבודה' },
            { value: 'not_started', label: 'נותרו השלמות' },
            { value: 'all_done', label: 'הכל הושלם' },
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
        <Card className="border-gray-300 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[750px]">
                <thead>
                  {/* Group headers */}
                  <tr>
                    <th rowSpan={2} className="text-right px-4 py-3 font-bold text-gray-700 text-sm bg-gray-100 sticky right-0 z-20 border-b-2 border-gray-300 min-w-[160px]">
                      לקוח
                    </th>
                    {COLUMN_GROUPS.map(group => (
                      <th key={group.key} colSpan={group.columns.length}
                        className={`px-3 py-2.5 text-center font-bold text-sm border-b-2 border-gray-300 border-x-2 border-gray-300 ${group.headerBg} ${group.headerText}`}>
                        <Link to={createPageUrl(group.drillDownPage)}
                          className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <group.icon className="w-4 h-4" />
                          {group.label}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      </th>
                    ))}
                  </tr>
                  {/* Sub-column headers */}
                  <tr className="border-b-2 border-gray-300">
                    {COLUMN_GROUPS.map(group =>
                      group.columns.map((col, idx) => {
                        const colStats = getColumnStats(col.key);
                        return (
                          <th key={col.key} className={`px-2 py-2 text-center text-xs font-semibold text-gray-600 ${group.bgColor} ${idx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                            <div>{col.label}</div>
                            <div className="text-[10px] font-normal text-gray-400 mt-0.5">{colStats.pct}% ({colStats.done}/{colStats.total})</div>
                          </th>
                        );
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, index) => {
                    const clientHasPayroll = hasPayroll(client);
                    const data = clientDataMap[client.name] || {};
                    const allClientTasks = Object.values(data).flat();
                    const clientDone = allClientTasks.filter(t => t.status === 'completed').length;
                    const clientTotal = allClientTasks.length;

                    return (
                      <tr key={client.id}
                        className={`border-b border-gray-200 transition-colors hover:bg-emerald-50/30 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        {/* Client name cell */}
                        <td className="px-4 py-2.5 sticky right-0 z-10 border-l-2 border-gray-300"
                          style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa' }}>
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
                                <div className="text-[10px] text-gray-400 mt-0.5">
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
                        {COLUMN_GROUPS.map(group =>
                          group.columns.map((col, colIdx) => {
                            // Payroll N/A for non-payroll clients
                            if (group.key === 'payroll' && !clientHasPayroll) {
                              return (
                                <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                                  <div className={`${STATUS_CONFIG.not_relevant.bg} text-gray-900 rounded py-1.5 text-xs font-bold mx-0.5`}>
                                    {STATUS_CONFIG.not_relevant.label}
                                  </div>
                                </td>
                              );
                            }
                            // Additional services: N/A if client doesn't have this service
                            if (group.serviceCheck && col.service && !client.service_types?.includes(col.service)) {
                              return (
                                <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                                  <div className="bg-gray-50 text-gray-300 rounded py-1.5 text-[10px] mx-0.5">-</div>
                                </td>
                              );
                            }

                            const bestTask = getCellStatus(client.name, col.key);
                            if (!bestTask) {
                              // Check if bimonthly off-month → show "לא רלוונטי"
                              if (isBimonthlyOffMonth(client, col.key, selectedMonth)) {
                                return (
                                  <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                                    <div className={`${STATUS_CONFIG.not_relevant.bg} text-gray-400 rounded py-1.5 text-xs font-bold mx-0.5`}>
                                      דו-חודשי
                                    </div>
                                  </td>
                                );
                              }
                              // Empty cell - clickable to create task
                              return (
                                <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                                  <button
                                    onClick={(e) => handleCreateTask(e, client, col, group)}
                                    className="w-full bg-white hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded py-1.5 text-xs font-medium mx-0.5 border border-dashed border-gray-200 hover:border-emerald-300 transition-all cursor-pointer group/empty"
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
                              <td key={col.key} className={`px-1 py-1.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                                <button
                                  onClick={(e) => handleCellClick(e, client, col, group)}
                                  className={`w-full ${config.bg} text-gray-900 rounded py-1.5 text-xs font-bold mx-0.5 hover:opacity-80 hover:shadow-sm transition-all cursor-pointer ${isActive ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                                  title={`${client.name} - ${col.label}: ${config.label} (לחץ לשינוי סטטוס)`}
                                >
                                  {config.label}
                                  {cellTasks.length > 1 && (
                                    <span className="text-[9px] opacity-70 mr-1">({cellTasks.length})</span>
                                  )}
                                </button>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer */}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-4 py-2.5 sticky right-0 bg-gray-100 z-10 text-sm font-bold text-gray-700 border-l-2 border-gray-300">
                      סה"כ ({filteredClients.length} לקוחות)
                    </td>
                    {COLUMN_GROUPS.map(group =>
                      group.columns.map((col, colIdx) => {
                        const colStats = getColumnStats(col.key);
                        return (
                          <td key={col.key} className={`px-2 py-2.5 text-center ${colIdx === 0 ? 'border-r-2 border-gray-300' : 'border-r border-gray-200'}`}>
                            <div className="text-sm font-bold text-gray-700">{colStats.pct}%</div>
                            <div className="text-[10px] text-gray-500">{colStats.done}/{colStats.total}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
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
        <Card className="p-12 text-center border-gray-200 shadow-sm">
          <Users className="w-14 h-14 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">אין לקוחות פעילים להצגה</h3>
          <p className="text-sm text-gray-400 mb-4">הוסף לקוחות דרך ניהול לקוחות או שנה סינון</p>
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
              <div className="text-xs text-gray-500">{popover.col.label} - {popover.task ? 'שינוי סטטוס' : 'יצירת משימה חדשה'}</div>
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
                  <span className={isCurrent ? '' : 'mr-5'}>{config.label}</span>
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
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
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
        {COLUMN_GROUPS.map(group => {
          const Icon = group.icon;
          const groupTasks = tasks.filter(t =>
            group.columns.some(col => col.categories.includes(t.category))
          );
          const groupDone = groupTasks.filter(t => t.status === 'completed').length;
          const groupPct = groupTasks.length > 0 ? Math.round((groupDone / groupTasks.length) * 100) : 0;

          return (
            <Link key={group.key} to={createPageUrl(group.drillDownPage)}>
              <Card className="border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${group.headerBg} shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-700 group-hover:text-emerald-700 transition-colors">{group.label}</div>
                    <div className="text-xs text-gray-400">
                      {groupDone}/{groupTasks.length} הושלמו
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${groupPct}%` }} />
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        <Link to={createPageUrl('ClientManagement')}>
          <Card className="border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-500 shadow-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-700 group-hover:text-emerald-700 transition-colors">ניהול לקוחות</div>
                <div className="text-xs text-gray-400">הוספה, עריכה וצפייה</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
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
  );
}
