/**
 * תוצרים — רווח והפסד
 * =====================
 * מציג רק לקוחות שמוגדר להם שירות pnl_reports בכרטיס הלקוח.
 *
 * חוק מרכזי: כרטיס הלקוח הוא מקור הסמכות היחיד.
 *   - אין pnl_reports ב-service_types → הלקוח לא מופיע כאן.
 *   - הנה"ח (P2) היא תנאי מקדים, אך לא מעניקה זכאות אוטומטית.
 *
 * עמודות: לקוח, תדירות, יום יעד, ייצור הנה"ח (תנאי מקדים), מוכנות רוה"ס
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, Task } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  RefreshCw, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp,
  CheckCircle, AlertTriangle, Clock, Minus, Target,
  Inbox, PlayCircle, Radio, Send, Eye, FileWarning, CircleCheck,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import ResizableTable from '@/components/ui/ResizableTable';
import { getTaskReportingMonth } from '@/config/automationRules';
import MiroProcessMap from '@/components/views/MiroProcessMap';
import DashboardViewToggle from '@/components/dashboard/DashboardViewToggle';
import KanbanView from '@/components/tasks/KanbanView';
import ProjectTimelineView from '@/components/dashboard/ProjectTimelineView';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import FocusMapView from '@/components/canvas/FocusMapView';
import AyoaWorkflowView from '@/components/canvas/AyoaWorkflowView';
import { ADDITIONAL_SERVICES, TAX_SERVICES } from '@/config/processTemplates';


// Status pipeline for DNA-style KPI cards (ordered by workflow progression)
const STATUS_PIPELINE = [
  { key: 'waiting_for_materials', label: 'ממתין לחומרים',       color: '#F59E0B', bg1: '#fffbeb', bg2: '#fef3c7', Icon: Inbox },
  { key: 'not_started',          label: 'לבצע',                color: '#64748B', bg1: '#f8fafc', bg2: '#f1f5f9', Icon: PlayCircle },
  { key: 'ready_to_broadcast',   label: 'מוכן לשידור',         color: '#0D9488', bg1: '#f0fdfa', bg2: '#ccfbf1', Icon: Radio },
  { key: 'reported_pending_payment', label: 'ממתין לתשלום',     color: '#4F46E5', bg1: '#eef2ff', bg2: '#e0e7ff', Icon: Send },
  { key: 'sent_for_review',      label: 'הועבר לעיון',         color: '#7C3AED', bg1: '#faf5ff', bg2: '#f3e8ff', Icon: Eye },
  { key: 'needs_corrections',    label: 'לתיקון',              color: '#EA580C', bg1: '#fff7ed', bg2: '#ffedd5', Icon: FileWarning },
  { key: 'production_completed', label: 'הושלם',               color: '#16A34A', bg1: '#f0fdf4', bg2: '#dcfce7', Icon: CircleCheck },
];

// ============================================================
// Hebrew labels
// ============================================================

const READINESS_LEVELS = {
  ready:       { label: 'מוכן',         color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
  in_progress: { label: 'בתהליך',       color: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500',     icon: Clock },
  waiting:     { label: 'ממתין לייצור', color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   icon: AlertTriangle },
  not_started: { label: 'טרם התחיל',    color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',   icon: Minus },
};

const FREQUENCY_HEBREW = {
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי',
  not_applicable: 'לא רלוונטי',
};

// P2 production categories — prerequisite for P&L
const P2_PRODUCTION_CATEGORIES = [
  'הנהלת חשבונות', 'work_bookkeeping',
];

// ============================================================
// Main Component
// ============================================================

export default function FinancialResultsDashboard() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set(['ready', 'in_progress', 'waiting', 'not_started']));
  const [allExpanded, setAllExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => { loadData(); }, [selectedMonth]);

  // Live-refresh: listen for cascade events from other pages
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.list(null, 5000).catch(() => []),
      ]);
      setClients(clientsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
    setIsLoading(false);
  };

  // STRICT: Only clients with pnl_reports in service_types
  const pnlClients = useMemo(() =>
    (clients || []).filter(c => {
      if (c.status !== 'active' && c.status !== 'balance_sheet_only') return false;
      const types = c.service_types || [];
      return types.includes('pnl_reports');
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
    [clients]
  );

  // Tasks for selected reporting month
  const monthStr = format(selectedMonth, 'yyyy-MM');
  const monthTasks = useMemo(() =>
    (tasks || []).filter(t => getTaskReportingMonth(t) === monthStr),
    [tasks, monthStr]
  );

  // ── CONTEXTUAL FILTER: Only PNL + bookkeeping tasks for AYOA map ──
  const PNL_MAP_CATEGORIES = ['רווח והפסד', 'work_pnl', 'pnl_reports', 'הנהלת חשבונות', 'work_bookkeeping'];
  const pnlMapTasks = useMemo(() =>
    monthTasks.filter(t => PNL_MAP_CATEGORIES.includes(t.category)),
    [monthTasks]
  );

  // Build rows — one per pnl_reports client
  const rows = useMemo(() => {
    return pnlClients.map(client => {
      const clientTasks = monthTasks.filter(t => t.client_name === client.name);

      // P2 production status (prerequisite check)
      const productionTasks = clientTasks.filter(t =>
        P2_PRODUCTION_CATEGORIES.includes(t.category)
      );
      const totalProd = productionTasks.length;
      const doneProd = productionTasks.filter(t =>
        t.status === 'production_completed'
      ).length;
      const productionDone = totalProd > 0 && doneProd === totalProd;
      const productionStatus = totalProd === 0 ? 'not_started'
        : productionDone ? 'ready'
        : doneProd > 0 ? 'in_progress'
        : 'not_started';

      // PNL frequency + target day from client card
      const pnlFrequency = client.reporting_info?.pnl_frequency || 'not_applicable';
      const pnlTargetDay = client.reporting_info?.pnl_target_day || '—';

      // P&L readiness: depends on P2 production being done
      let pnlStatus;
      if (!productionDone && totalProd > 0) {
        pnlStatus = 'waiting'; // waiting for prerequisite
      } else if (productionDone) {
        // Production done → P&L can proceed. Check if there's a pnl-specific task
        const pnlTasks = clientTasks.filter(t =>
          t.category === 'pnl_reports' || t.category === 'רווח והפסד' || t.category === 'work_pnl'
        );
        if (pnlTasks.length > 0) {
          const pnlDone = pnlTasks.every(t => t.status === 'production_completed');
          const pnlInProgress = pnlTasks.some(t => t.status === 'sent_for_review' || t.status === 'review_after_corrections' || t.status === 'needs_corrections' || t.status === 'ready_to_broadcast' || t.status === 'reported_pending_payment');
          pnlStatus = pnlDone ? 'ready' : pnlInProgress ? 'in_progress' : 'not_started';
        } else {
          // No PNL task yet but production is done → ready to start
          pnlStatus = 'not_started';
        }
      } else {
        pnlStatus = 'not_started';
      }

      return {
        client,
        pnlFrequency,
        pnlTargetDay,
        productionStatus,
        totalProd,
        doneProd,
        pnlStatus,
      };
    });
  }, [pnlClients, monthTasks]);

  // Filter by search
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter(r => r.client.name?.toLowerCase().includes(lower));
  }, [rows, search]);

  const groupedRows = useMemo(() => {
    const groups = {};
    filteredRows.forEach(row => {
      const key = row.pnlStatus || 'not_started';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      const order = ['waiting', 'not_started', 'in_progress', 'ready'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [filteredRows]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const ready = rows.filter(r => r.pnlStatus === 'ready').length;
    const inProgress = rows.filter(r => r.pnlStatus === 'in_progress').length;
    const waiting = rows.filter(r => r.pnlStatus === 'waiting').length;
    return { total, ready, inProgress, waiting };
  }, [rows]);

  // Pipeline stats from actual task statuses (for DNA pipeline cards)
  const pipelineStats = useMemo(() => {
    const byStatus = {};
    STATUS_PIPELINE.forEach(s => { byStatus[s.key] = 0; });
    pnlMapTasks.forEach(t => {
      const s = t.status || 'not_started';
      if (byStatus[s] !== undefined) byStatus[s]++;
    });
    return { total: pnlMapTasks.length, byStatus };
  }, [pnlMapTasks]);

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
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-900 border border-[#E0E0E0] dark:border-gray-700 shadow-xl rounded-[32px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 rounded-xl">
            <TrendingUp className="w-7 h-7 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">תוצרים — רווח והפסד</h1>
            <p className="text-sm text-gray-500">
              לקוחות עם שירות דוחות רוה"ס בלבד | {format(selectedMonth, 'MMMM yyyy', { locale: he })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[12px] text-gray-400">חודש דיווח</div>
              <div className="font-semibold text-sm text-gray-700">
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
          <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
          <div className="text-xs text-gray-500">לקוחות עם רוה"ס</div>
        </CardContent></Card>
        <Card className="border-emerald-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.ready}</div>
          <div className="text-xs text-gray-500">דוח מוכן</div>
        </CardContent></Card>
        <Card className="border-sky-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-sky-600">{stats.inProgress}</div>
          <div className="text-xs text-gray-500">בתהליך</div>
        </CardContent></Card>
        <Card className="border-amber-200"><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.waiting}</div>
          <div className="text-xs text-gray-500">ממתין לייצור</div>
        </CardContent></Card>
      </div>

      {/* Search + Expand/Collapse */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (allExpanded) {
              setCollapsedGroups(new Set(['ready', 'in_progress', 'waiting', 'not_started']));
              setAllExpanded(false);
            } else {
              setCollapsedGroups(new Set());
              setAllExpanded(true);
            }
          }}>
            {allExpanded ? <ChevronUp className="w-4 h-4 ms-1" /> : <ChevronDown className="w-4 h-4 ms-1" />}
            {allExpanded ? 'כווץ הכל' : 'הרחב הכל'}
          </Button>
        </div>
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pe-10 h-9"
        />
      </div>
      </div>

      {/* DNA Pipeline Status Cards */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        <div className="rounded-xl px-2 py-1.5 flex items-center gap-1.5 shrink-0 border border-slate-200"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(70,130,180,0.1)' }}>
            <Target className="w-3.5 h-3.5" style={{ color: '#4682B4' }} />
          </div>
          <div className="text-center">
            <div className="text-base leading-tight font-black text-slate-700">{pipelineStats.total}</div>
            <div className="text-[9px] text-slate-400 font-medium">משימות</div>
          </div>
        </div>
        {STATUS_PIPELINE.map((phase, idx) => {
          const count = pipelineStats.byStatus[phase.key] || 0;
          const pct = pipelineStats.total > 0 ? Math.round((count / pipelineStats.total) * 100) : 0;
          const Icon = phase.Icon;
          return (
            <React.Fragment key={phase.key}>
              {idx > 0 && <div className="flex items-center shrink-0"><div className="w-1 h-1 rounded-full bg-slate-300" /></div>}
              <div className="rounded-xl px-2 py-1.5 flex items-center gap-1.5 shrink-0 border shadow-sm"
                style={{ background: `linear-gradient(135deg, ${phase.bg1} 0%, ${phase.bg2} 100%)`, borderColor: count > 0 ? phase.color + '30' : '#e2e8f0', opacity: count === 0 ? 0.5 : 1 }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: phase.color + '15' }}>
                  <Icon className="w-3 h-3" style={{ color: phase.color }} />
                </div>
                <div className="text-center min-w-[28px]">
                  <div className="text-base font-black leading-tight" style={{ color: count > 0 ? phase.color : '#94a3b8' }}>{count}</div>
                  <div className="text-[9px] text-slate-600 font-bold leading-tight whitespace-nowrap">{phase.label}</div>
                </div>
                {count > 0 && <div className="text-[9px] font-bold rounded-full px-1 py-0.5" style={{ color: phase.color, background: phase.color + '15' }}>{pct}%</div>}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <DashboardViewToggle value={viewMode} onChange={setViewMode} options={['table', 'miro', 'kanban', 'timeline', 'radial', 'focus', 'workflow']} />

      {viewMode === 'kanban' ? (
        <KanbanView tasks={pnlMapTasks} onTaskStatusChange={async (task, status) => { await Task.update(task.id, { status }); loadData(); }} clients={clients} />
      ) : viewMode === 'timeline' ? (
        <ProjectTimelineView tasks={pnlMapTasks} month={selectedMonth.getMonth() + 1} year={selectedMonth.getFullYear()} />
      ) : viewMode === 'radial' ? (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
          <AyoaRadialView tasks={pnlMapTasks} centerLabel="תוצרים" centerSub="רווח והפסד" />
        </div>
      ) : viewMode === 'focus' ? (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
          <FocusMapView tasks={pnlMapTasks} allTasks={tasks} centerLabel="תוצרים" centerSub={`${pnlMapTasks.length} משימות`} />
        </div>
      ) : viewMode === 'workflow' ? (
        <AyoaWorkflowView tasks={pnlMapTasks} />
      ) : viewMode === 'miro' ? (
        <MiroProcessMap
          tasks={pnlMapTasks}
          centerLabel="התאמות ומאזנים"
          centerSub={`חודש ${format(selectedMonth, 'MMMM', { locale: he })}`}
          phases={[
            { label: 'הנהלת חשבונות', serviceKeys: ['bookkeeping', 'הנהלת חשבונות', 'work_bookkeeping'], services: [ADDITIONAL_SERVICES.bookkeeping].filter(Boolean) },
            { label: 'רווח והפסד', serviceKeys: ['pnl_reports', 'רווח והפסד', 'work_pnl'], services: [ADDITIONAL_SERVICES.pnl_reports || TAX_SERVICES.pnl_reports].filter(Boolean) },
          ]}
        />
      ) : (
      <>
      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <ResizableTable className="w-full text-sm" stickyHeader maxHeight="70vh">
              <thead>
                <tr className="border-b bg-[#F5F5F5]">
                  <th className="text-center p-2 w-10 bg-gray-100">#</th>
                  <th className="text-start p-3 font-semibold min-w-[180px] bg-gray-100 sticky right-0 z-20 border-l">
                    לקוח
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[100px] bg-gray-50">
                    <div className="text-xs">תדירות</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[80px] bg-gray-50">
                    <div className="text-xs">יום יעד</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[130px] bg-teal-50">
                    <div className="text-xs">ייצור הנה"ח</div>
                    <div className="text-[12px] text-gray-400 font-normal">תנאי מקדים</div>
                  </th>
                  <th className="text-center p-2 font-semibold min-w-[120px] bg-emerald-50">
                    <div className="text-xs">רווח והפסד</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(([statusKey, rows]) => {
                  const cfg = READINESS_LEVELS[statusKey] || READINESS_LEVELS.not_started;
                  const isOpen = !collapsedGroups.has(statusKey);
                  return (
                    <React.Fragment key={statusKey}>
                      <tr
                        className="bg-[#F5F5F5] cursor-pointer hover:bg-[#EEEEEE] border-b"
                        onClick={() => setCollapsedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(statusKey)) next.delete(statusKey);
                          else next.add(statusKey);
                          return next;
                        })}
                      >
                        <td colSpan={6} className="p-2">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                            {cfg.label} ({rows.length})
                          </div>
                        </td>
                      </tr>
                      {isOpen && rows.map((row, idx) => (
                        <tr key={row.client.id} className={`border-b hover:bg-[#F5F5F5] ${idx % 2 === 0 ? '' : 'bg-[#F5F5F5]'}`}>
                          <td className="text-center p-2 text-xs text-gray-400">{idx + 1}</td>
                          <td className="p-3 font-medium sticky right-0 bg-white z-10 border-l">
                            {row.client.name}
                          </td>
                          <td className="text-center p-2 text-xs text-gray-600">
                            {FREQUENCY_HEBREW[row.pnlFrequency] || row.pnlFrequency}
                          </td>
                          <td className="text-center p-2 text-xs text-gray-600">
                            {row.pnlTargetDay}
                          </td>
                          <td className="text-center p-2">
                            <StatusBadge status={row.productionStatus} />
                            {row.totalProd > 0 && (
                              <div className="text-[12px] text-gray-400 mt-1">
                                {row.doneProd}/{row.totalProd}
                              </div>
                            )}
                          </td>
                          <td className="text-center p-2">
                            <StatusBadge status={row.pnlStatus} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      {search ? 'לא נמצאו לקוחות' : 'אין לקוחות עם שירות רווח והפסד פעיל'}
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
      </>
      )}
    </div>
  );
}
