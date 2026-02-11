
import React, { useState, useEffect, useMemo } from 'react';
import { Client, Task } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import {
  Loader, RefreshCw, Users, Search,
  CheckCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  ExternalLink, Calculator, Briefcase, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';

// === Column Groups - Taxes and Payroll only (Reconciliations later) ===
const COLUMN_GROUPS = [
  {
    key: 'taxes',
    label: 'מיסים',
    color: 'bg-slate-50',
    headerColor: 'bg-slate-100 text-slate-700',
    drillDownPage: 'TaxReportsDashboard',
    icon: Calculator,
    columns: [
      { key: 'vat', label: 'מע"מ', categories: ['מע"מ', 'work_vat_reporting'] },
      { key: 'tax_advances', label: 'מקדמות מ"ה', categories: ['מקדמות מס', 'work_tax_advances'] },
    ],
  },
  {
    key: 'payroll',
    label: 'שכר',
    color: 'bg-gray-50',
    headerColor: 'bg-gray-100 text-gray-700',
    drillDownPage: 'PayrollDashboard',
    icon: Briefcase,
    columns: [
      { key: 'payroll', label: 'שכר', categories: ['שכר', 'work_payroll'] },
      { key: 'social_security', label: 'ביט"ל', categories: ['ביטוח לאומי', 'work_social_security'] },
      { key: 'deductions', label: 'ניכויים', categories: ['ניכויים', 'work_deductions'] },
    ],
  },
];

const ALL_COLUMNS = COLUMN_GROUPS.flatMap(g => g.columns);

// Calm, professional color scheme - greens and grays, minimal red
const STATUS_CONFIG = {
  not_started: { label: 'ממתין', color: 'bg-gray-100 text-gray-600', dotColor: 'bg-gray-400', priority: 3 },
  in_progress: { label: 'בעבודה', color: 'bg-emerald-50 text-emerald-700', dotColor: 'bg-emerald-500', priority: 2 },
  completed: { label: 'הושלם', color: 'bg-emerald-100 text-emerald-800', dotColor: 'bg-emerald-600', priority: 5 },
  postponed: { label: 'נדחה', color: 'bg-gray-100 text-gray-500', dotColor: 'bg-gray-400', priority: 4 },
  waiting_for_approval: { label: 'לבדיקה', color: 'bg-amber-50 text-amber-700', dotColor: 'bg-amber-500', priority: 2 },
  waiting_for_materials: { label: 'ממתין לחומרים', color: 'bg-gray-200 text-gray-600', dotColor: 'bg-gray-500', priority: 1 },
  issue: { label: 'דורש טיפול', color: 'bg-amber-100 text-amber-800', dotColor: 'bg-amber-600', priority: 0 },
  issues: { label: 'דורש טיפול', color: 'bg-amber-100 text-amber-800', dotColor: 'bg-amber-600', priority: 0 },
  ready_for_reporting: { label: 'מוכן לדיווח', color: 'bg-teal-50 text-teal-700', dotColor: 'bg-teal-500', priority: 3 },
  reported_waiting_for_payment: { label: 'ממתין לתשלום', color: 'bg-sky-50 text-sky-700', dotColor: 'bg-sky-500', priority: 4 },
};

export default function ClientsDashboardPage() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => { loadData(); }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.filter({
          due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }).catch(() => []),
      ]);

      setClients(
        (clientsData || [])
          .filter(c => c.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      );
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setIsLoading(false);
  };

  // Build client -> column -> items lookup
  const clientDataMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const clientName = task.client_name;
      if (!clientName) return;
      for (const col of ALL_COLUMNS) {
        if (col.categories && col.categories.includes(task.category)) {
          if (!map[clientName]) map[clientName] = {};
          if (!map[clientName][col.key]) map[clientName][col.key] = [];
          map[clientName][col.key].push({ type: 'task', data: task, status: task.status });
          break;
        }
      }
    });
    return map;
  }, [tasks]);

  const getCellPrimaryStatus = (clientName, colKey) => {
    const items = clientDataMap[clientName]?.[colKey];
    if (!items || items.length === 0) return null;
    return items.reduce((best, item) => {
      const bestP = STATUS_CONFIG[best.status]?.priority ?? 99;
      const itemP = STATUS_CONFIG[item.status]?.priority ?? 99;
      return itemP < bestP ? item : best;
    }, items[0]);
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(term));
    }
    if (statusFilter !== 'all') {
      result = result.filter(client => {
        const data = clientDataMap[client.name] || {};
        const allItems = Object.values(data).flat();
        if (statusFilter === 'has_issues') return allItems.some(i => i.status === 'issue' || i.status === 'issues' || i.status === 'waiting_for_materials');
        if (statusFilter === 'all_done') return allItems.length > 0 && allItems.every(i => i.status === 'completed');
        if (statusFilter === 'in_progress') return allItems.some(i => i.status !== 'completed' && i.status !== 'not_started');
        if (statusFilter === 'not_started') return allItems.some(i => i.status === 'not_started');
        return true;
      });
    }
    return result;
  }, [clients, searchTerm, statusFilter, clientDataMap]);

  const stats = useMemo(() => {
    let total = 0, completed = 0, issues = 0, inProgress = 0;
    clients.forEach(client => {
      const data = clientDataMap[client.name] || {};
      ALL_COLUMNS.forEach(col => {
        const items = data[col.key];
        if (items && items.length > 0) {
          total++;
          const primary = getCellPrimaryStatus(client.name, col.key);
          if (primary?.status === 'completed') completed++;
          else if (primary?.status === 'issue' || primary?.status === 'issues' || primary?.status === 'waiting_for_materials') issues++;
          else if (primary?.status !== 'not_started') inProgress++;
        }
      });
    });
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, issues, inProgress, pct };
  }, [clients, clientDataMap]);

  const handleMonthChange = (dir) => {
    setSelectedMonth(curr => dir === 'prev' ? subMonths(curr, 1) : addMonths(curr, 1));
  };

  const renderCell = (clientName, col) => {
    const primary = getCellPrimaryStatus(clientName, col.key);
    if (!primary) {
      return (
        <td key={col.key} className="px-1 py-1.5 text-center border-l border-gray-100/60">
          <span className="text-gray-300 text-xs">-</span>
        </td>
      );
    }
    const config = STATUS_CONFIG[primary.status] || STATUS_CONFIG.not_started;
    return (
      <td key={col.key} className="px-1 py-1 text-center border-l border-gray-100/60">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSelectedCell({
                  clientName, colKey: col.key, colLabel: col.label,
                  items: clientDataMap[clientName]?.[col.key] || []
                })}
                className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color} hover:opacity-80 transition-all cursor-pointer min-w-[54px]`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                {config.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>{clientName} - {col.label}: {config.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
    );
  };

  const serviceTypeLabel = (st) => {
    const labels = {
      full_service: 'מלא', bookkeeping: 'הנה"ח', payroll: 'שכר',
      tax_reports: 'מס', vat: 'מע"מ', annual_reports: 'שנתי',
      vat_reporting: 'מע"מ', reconciliation: 'התאמות', consulting: 'ייעוץ',
    };
    return labels[st] || st;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">לוח לקוחות</h1>
            <p className="text-sm text-gray-500">מצב דיווחים - {format(selectedMonth, 'MMMM yyyy', { locale: he })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm w-28 text-center text-gray-700">
            {format(selectedMonth, 'MMMM yyyy', { locale: he })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" className="h-8 w-8" disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Summary - clean, minimal */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <Card className="border-gray-200/80 shadow-sm">
          <CardContent className="p-2.5 text-center">
            <div className="text-xl font-bold text-gray-700">{filteredClients.length}</div>
            <div className="text-[11px] text-gray-400">לקוחות</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200/80 shadow-sm">
          <CardContent className="p-2.5 text-center">
            <div className="text-xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-[11px] text-gray-400">משימות</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/60 shadow-sm">
          <CardContent className="p-2.5 text-center">
            <div className="text-xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-[11px] text-gray-400">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200/80 shadow-sm hidden md:block">
          <CardContent className="p-2.5 text-center">
            <div className="text-xl font-bold text-amber-600">{stats.issues}</div>
            <div className="text-[11px] text-gray-400">דורש טיפול</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/60 shadow-sm hidden md:block">
          <CardContent className="p-2.5 text-center">
            <div className="text-xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-[11px] text-gray-400">התקדמות</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - clean */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 w-4 h-4" />
          <Input placeholder="חיפוש לקוח..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 h-9 text-sm border-gray-200" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44 h-9 text-sm border-gray-200">
            <SelectValue placeholder="סנן" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="has_issues">דורש טיפול</SelectItem>
            <SelectItem value="in_progress">בעבודה</SelectItem>
            <SelectItem value="not_started">טרם התחיל</SelectItem>
            <SelectItem value="all_done">הושלם</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : filteredClients.length > 0 ? (
        <Card className="border-gray-200/80 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  {/* Group headers */}
                  <tr>
                    <th rowSpan={2} className="text-right px-3 py-2 font-semibold text-gray-600 text-sm bg-white sticky right-0 z-20 border-b border-gray-200 min-w-[140px]">
                      לקוח
                    </th>
                    {COLUMN_GROUPS.map(group => (
                      <th key={group.key} colSpan={group.columns.length}
                        className={`px-2 py-1.5 text-center font-semibold text-xs border-b border-x border-gray-200/80 ${group.headerColor}`}>
                        <Link to={createPageUrl(group.drillDownPage)}
                          className="inline-flex items-center gap-1 hover:underline">
                          {group.label}
                          <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                        </Link>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200">
                    {COLUMN_GROUPS.map(group =>
                      group.columns.map(col => (
                        <th key={col.key} className={`px-2 py-1.5 text-center text-[11px] font-medium text-gray-500 border-x border-gray-100/60 ${group.color}`}>
                          {col.label}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, index) => {
                    const data = clientDataMap[client.name] || {};
                    const hasAnyData = Object.keys(data).length > 0;
                    const hasPayroll = client.service_types?.some(st =>
                      ['payroll', 'full_service', 'bookkeeping'].includes(st)
                    ) || client.reporting_info?.payroll_frequency === 'monthly';

                    return (
                      <tr key={client.id}
                        className={`border-b border-gray-100/80 transition-colors hover:bg-emerald-50/20 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-1.5 sticky right-0 bg-inherit z-10 border-l border-gray-200/60">
                          <div className="font-medium text-gray-700 text-sm">{client.name}</div>
                          <div className="flex gap-0.5 mt-0.5">
                            {(client.service_types || []).slice(0, 3).map(st => (
                              <span key={st} className="text-[9px] bg-gray-100/80 text-gray-400 px-1 rounded">
                                {serviceTypeLabel(st)}
                              </span>
                            ))}
                            {!hasAnyData && <span className="text-[9px] text-gray-300 italic">ללא משימות</span>}
                          </div>
                        </td>
                        {COLUMN_GROUPS.map(group =>
                          group.columns.map(col => {
                            // Show dash for payroll columns on non-payroll clients
                            if (group.key === 'payroll' && !hasPayroll) {
                              return (
                                <td key={col.key} className="px-1 py-1 text-center border-l border-gray-100/60">
                                  <span className="text-gray-200 text-xs">-</span>
                                </td>
                              );
                            }
                            return <React.Fragment key={col.key}>{renderCell(client.name, col)}</React.Fragment>;
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer with completion percentages */}
                <tfoot>
                  <tr className="bg-gray-50/80 border-t border-gray-200">
                    <td className="px-3 py-2 sticky right-0 bg-gray-50/80 z-10 text-xs font-medium text-gray-500">
                      סה"כ
                    </td>
                    {COLUMN_GROUPS.map(group =>
                      group.columns.map(col => {
                        let total = 0, done = 0;
                        clients.forEach(c => {
                          const items = clientDataMap[c.name]?.[col.key];
                          if (items && items.length > 0) {
                            total++;
                            const primary = getCellPrimaryStatus(c.name, col.key);
                            if (primary?.status === 'completed') done++;
                          }
                        });
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                          <td key={col.key} className="px-1 py-2 text-center border-l border-gray-200/60">
                            <div className="text-xs font-semibold text-gray-600">{pct}%</div>
                            <div className="text-[9px] text-gray-400">{done}/{total}</div>
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
        <Card className="p-10 text-center border-gray-200/80">
          <Users className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <h3 className="text-lg font-medium text-gray-500 mb-1">אין לקוחות פעילים להצגה</h3>
          <p className="text-sm text-gray-400">הוסף לקוחות או שנה סינון</p>
        </Card>
      )}

      {/* Quick navigation links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {COLUMN_GROUPS.map(group => {
          const Icon = group.icon;
          return (
            <Link key={group.key} to={createPageUrl(group.drillDownPage)}>
              <Card className="border-gray-200/80 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${group.headerColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-700">{group.label}</div>
                    <div className="text-[11px] text-gray-400">פירוט מלא</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        <Link to={createPageUrl('ClientManagement')}>
          <Card className="border-gray-200/80 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-700">ניהול לקוחות</div>
                <div className="text-[11px] text-gray-400">הוספה ועריכה</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Legend - subtle */}
      <div className="flex flex-wrap gap-1.5 justify-center py-2">
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'issues').map(([key, config]) => (
          <span key={key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
            <span className={`w-1 h-1 rounded-full ${config.dotColor}`} />
            {config.label}
          </span>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => { if (!open) setSelectedCell(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedCell?.clientName} - {selectedCell?.colLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {format(selectedMonth, 'MMMM yyyy', { locale: he })}
            </DialogDescription>
          </DialogHeader>
          {selectedCell?.items && selectedCell.items.length > 0 ? (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {selectedCell.items.map((item, idx) => {
                const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.not_started;
                const d = item.data;
                return (
                  <div key={idx} className="p-3 border border-gray-200/80 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-gray-700">{d.title}</span>
                      <Badge className={`${config.color} text-[10px] px-1.5`}>{config.label}</Badge>
                    </div>
                    {d.due_date && (
                      <div className="text-[11px] text-gray-400">תאריך יעד: {d.due_date}</div>
                    )}
                    {d.description && (
                      <div className="text-[11px] text-gray-500 whitespace-pre-wrap">{d.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-gray-400">אין פריטים</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
