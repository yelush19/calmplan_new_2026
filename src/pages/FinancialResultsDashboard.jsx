/**
 * P2 | תוצרים (רווח והפסד)
 * ===========================
 * Financial results dashboard — shows per-client financial readiness.
 *
 * Columns: שם לקוח, סטטוס התאמות, סטטוס מאזן, יתרת עו"ש (ידני), רוה"ס (ידני), מוכנות
 *
 * This page does NOT show VAT/advances columns — those belong to ClientsDashboard.
 * This page does NOT show payroll data — that belongs to P1.
 *
 * Data sources:
 *   - Client entity: base info + service_types
 *   - Task entity: P2 bookkeeping tasks (reconciliation, bookkeeping steps)
 *   - BalanceSheet entity: annual balance sheet workflow stage
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, Task, BalanceSheet } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RefreshCw, Search, ChevronLeft, ChevronRight, TrendingUp,
  CheckCircle, AlertTriangle, Clock, Minus,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import ResizableTable from '@/components/ui/ResizableTable';
import { getTaskReportingMonth } from '@/config/automationRules';

// ============================================================
// Status configs
// ============================================================

const READINESS_LEVELS = {
  ready:       { label: 'מוכן',         color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
  in_progress: { label: 'בתהליך',       color: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500',     icon: Clock },
  attention:   { label: 'דורש תשומת לב', color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500',   icon: AlertTriangle },
  not_started: { label: 'טרם התחיל',     color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',   icon: Minus },
};

const BALANCE_STAGES = {
  closing_operations: 'פעולות סגירה',
  editing_for_audit:  'עריכה לביקורת',
  sent_to_auditor:    'שליחה לרו"ח',
  auditor_questions_1: 'שאלות רו"ח 1',
  auditor_questions_2: 'שאלות רו"ח 2',
  signed:             'חתימה ✓',
};

// P2 task categories that indicate bookkeeping production
const P2_PRODUCTION_CATEGORIES = [
  'הנהלת חשבונות', 'work_bookkeeping',
  'התאמות', 'work_reconciliation',
];

// P2 tax reporting categories (excluded from this page)
const P2_TAX_CATEGORIES = [
  'מע"מ', 'work_vat_reporting', 'מע"מ 874', 'work_vat_874',
  'מקדמות מס', 'work_tax_advances',
];

// ============================================================
// Main Component
// ============================================================

export default function FinancialResultsDashboard() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [balanceSheets, setBalanceSheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData, bsData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.filter({ context: 'work' }).catch(() => []),
        BalanceSheet.list(null, 500).catch(() => []),
      ]);
      setClients(clientsData || []);
      setTasks(tasksData || []);
      setBalanceSheets(bsData || []);
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
    setIsLoading(false);
  };

  // Only active clients with bookkeeping services
  const activeClients = useMemo(() =>
    (clients || []).filter(c => {
      if (c.status !== 'active' && c.status !== 'balance_sheet_only') return false;
      const types = c.service_types || [];
      return types.some(st => ['bookkeeping', 'vat_reporting', 'full_service'].includes(st));
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
    [clients]
  );

  // Tasks for selected reporting month — only P2 production tasks
  const monthStr = format(selectedMonth, 'yyyy-MM');
  const monthTasks = useMemo(() =>
    (tasks || []).filter(t => {
      if (P2_TAX_CATEGORIES.includes(t.category)) return false; // Exclude tax reporting
      return getTaskReportingMonth(t) === monthStr;
    }),
    [tasks, monthStr]
  );

  // Balance sheet lookup by client_id
  const bsLookup = useMemo(() => {
    const map = {};
    (balanceSheets || []).forEach(bs => {
      if (!map[bs.client_id] || bs.tax_year > map[bs.client_id].tax_year) {
        map[bs.client_id] = bs;
      }
    });
    return map;
  }, [balanceSheets]);

  // Build rows
  const rows = useMemo(() => {
    return activeClients.map(client => {
      const clientTasks = monthTasks.filter(t => t.client_name === client.name);
      const productionTasks = clientTasks.filter(t => P2_PRODUCTION_CATEGORIES.includes(t.category));
      const bs = bsLookup[client.id];

      // Bookkeeping production status
      const totalProd = productionTasks.length;
      const doneProd = productionTasks.filter(t => t.status === 'completed').length;
      const productionStatus = totalProd === 0 ? 'not_started'
        : doneProd === totalProd ? 'ready'
        : doneProd > 0 ? 'in_progress'
        : 'not_started';

      // Reconciliation status (from task steps)
      const reconTasks = clientTasks.filter(t =>
        ['התאמות', 'work_reconciliation'].includes(t.category)
      );
      const totalRecon = reconTasks.length;
      const doneRecon = reconTasks.filter(t => t.status === 'completed').length;
      const reconStatus = totalRecon === 0 ? 'not_started'
        : doneRecon === totalRecon ? 'ready'
        : doneRecon > 0 ? 'in_progress'
        : 'not_started';

      // Balance sheet status
      const bsStage = bs?.current_stage || null;
      const bsStatus = !bsStage ? 'not_started'
        : bsStage === 'signed' ? 'ready'
        : 'in_progress';

      // Overall readiness
      const allReady = productionStatus === 'ready' && reconStatus === 'ready';
      const anyInProgress = productionStatus === 'in_progress' || reconStatus === 'in_progress';
      const overallStatus = allReady ? 'ready'
        : anyInProgress ? 'in_progress'
        : 'not_started';

      return {
        client,
        productionStatus,
        totalProd,
        doneProd,
        reconStatus,
        totalRecon,
        doneRecon,
        bsStage,
        bsStatus,
        overallStatus,
      };
    });
  }, [activeClients, monthTasks, bsLookup]);

  // Filter by search
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter(r => r.client.name?.toLowerCase().includes(lower));
  }, [rows, search]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const ready = rows.filter(r => r.overallStatus === 'ready').length;
    const inProgress = rows.filter(r => r.overallStatus === 'in_progress').length;
    const notStarted = rows.filter(r => r.overallStatus === 'not_started').length;
    return { total, ready, inProgress, notStarted };
  }, [rows]);

  const handleMonthChange = (dir) => {
    setSelectedMonth(c => dir === 'prev' ? subMonths(c, 1) : addMonths(c, 1));
  };

  function StatusBadge({ status }) {
    const cfg = READINESS_LEVELS[status] || READINESS_LEVELS.not_started;
    return (
      <Badge className={`${cfg.color} text-xs px-2 py-0.5 gap-1`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 backdrop-blur-xl bg-white/45 border border-white/20 shadow-xl rounded-[32px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 rounded-xl">
            <TrendingUp className="w-7 h-7 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">P2 | תוצרים (רווח והפסד)</h1>
            <p className="text-sm text-gray-500">
              מוכנות כספית ללקוח — ייצור הנה"ח, התאמות, מאזן | {format(selectedMonth, 'MMMM yyyy', { locale: he })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[10px] text-slate-400">חודש דיווח</div>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
          <div className="text-xs text-slate-500">סה"כ לקוחות</div>
        </CardContent></Card>
        <Card className="border-emerald-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.ready}</div>
          <div className="text-xs text-slate-500">מוכנים</div>
        </CardContent></Card>
        <Card className="border-sky-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-sky-600">{stats.inProgress}</div>
          <div className="text-xs text-slate-500">בתהליך</div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-slate-500">{stats.notStarted}</div>
          <div className="text-xs text-slate-500">טרם התחילו</div>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 h-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <ResizableTable className="w-full text-sm" stickyHeader maxHeight="70vh">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-center p-2 w-10 bg-gray-100">#</th>
                  <th className="text-right p-3 font-semibold min-w-[180px] bg-gray-100 sticky right-0 z-20 border-l">
                    לקוח
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[130px] bg-teal-50">
                    <div className="text-xs">ייצור הנה"ח</div>
                    <div className="text-[10px] text-muted-foreground font-normal">שלב א'</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[130px] bg-teal-50">
                    <div className="text-xs">התאמות חשבונות</div>
                    <div className="text-[10px] text-muted-foreground font-normal">שלב ג'</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[130px] bg-indigo-50">
                    <div className="text-xs">מאזן שנתי</div>
                    <div className="text-[10px] text-muted-foreground font-normal">שלב ד'</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[100px] bg-emerald-50">
                    <div className="text-xs">מוכנות</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={row.client.id} className={`border-b hover:bg-muted/20 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="text-center p-2 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="p-3 font-medium sticky right-0 bg-white z-10 border-l">
                      {row.client.name}
                    </td>
                    <td className="text-center p-2">
                      <StatusBadge status={row.productionStatus} />
                      {row.totalProd > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {row.doneProd}/{row.totalProd}
                        </div>
                      )}
                    </td>
                    <td className="text-center p-2">
                      <StatusBadge status={row.reconStatus} />
                      {row.totalRecon > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {row.doneRecon}/{row.totalRecon}
                        </div>
                      )}
                    </td>
                    <td className="text-center p-2">
                      {row.bsStage ? (
                        <Badge className={`text-xs px-2 py-0.5 ${
                          row.bsStage === 'signed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {BALANCE_STAGES[row.bsStage] || row.bsStage}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center p-2">
                      <StatusBadge status={row.overallStatus} />
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {search ? 'לא נמצאו לקוחות' : 'אין לקוחות פעילים עם שירותי הנה"ח'}
                    </td>
                  </tr>
                )}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(READINESS_LEVELS).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className="text-gray-600">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
