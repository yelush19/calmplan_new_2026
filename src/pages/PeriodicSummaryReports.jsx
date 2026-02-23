import React, { useState, useEffect, useMemo } from 'react';
import { PeriodicReport, Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Plus, RefreshCw, CheckCircle, AlertCircle, Clock, Calendar,
  ChevronLeft, ChevronRight, FileText, Search, Pencil, Save, X,
  AlertTriangle, Check, CheckSquare, Square, Trash2, UserPlus
} from 'lucide-react';
import ResizableTable from '@/components/ui/ResizableTable';

// ============================================================
// Report definitions
// ============================================================

const REPORT_TYPES = {
  bituach_leumi_126: {
    key: 'bituach_leumi_126',
    label: '126 - ביטוח לאומי',
    shortLabel: 'בל 126',
    periods: ['h1', 'h2', 'annual'],
  },
  deductions_126_wage: {
    key: 'deductions_126_wage',
    label: '126 - מרכז שכר עבודה (מ"ה ניכויים)',
    shortLabel: 'מ"ה 126',
    periods: ['annual'],
  },
};

const PERIOD_CONFIG = {
  h1: { label: 'מחצית 1', shortLabel: 'מח׳ 1', monthRange: 'ינואר-יוני' },
  h2: { label: 'מחצית 2', shortLabel: 'מח׳ 2', monthRange: 'יולי-דצמבר' },
  annual: { label: 'שנתי', shortLabel: 'שנתי', monthRange: 'שנתי' },
};

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'טרם התחיל', color: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  { value: 'remaining_completions', label: 'נותרו השלמות', color: 'bg-cyan-200 text-cyan-700', dot: 'bg-cyan-400' },
  { value: 'reconciling', label: 'בהתאמות', color: 'bg-amber-200 text-amber-800', dot: 'bg-amber-500' },
  { value: 'ready_to_submit', label: 'מוכן לשידור', color: 'bg-teal-200 text-teal-800', dot: 'bg-teal-500' },
  { value: 'submitted', label: 'שודר', color: 'bg-emerald-400 text-white', dot: 'bg-emerald-500' },
];

const RECONCILIATION_STEPS = [
  { key: 'payroll_vs_bookkeeping', label: 'התאמה: שכר מול הנהלת חשבונות' },
  { key: 'periodic_vs_annual', label: 'התאמה: דיווחים תקופתיים מול שנתי' },
];

function getDefaultTargetDate(year, period) {
  const y = parseInt(year);
  if (period === 'h1') return `${y}-07-18`;
  if (period === 'h2') return `${y + 1}-01-18`;
  if (period === 'annual') return `${y + 1}-04-30`;
  return '';
}

function getStatusConfig(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

// ============================================================
// Report Cell Component — clickable status cell in the table
// ============================================================
function ReportCell({ report, onEdit }) {
  if (!report) {
    return <td className="p-2 text-center text-muted-foreground text-xs">—</td>;
  }

  const statusConfig = getStatusConfig(report.status);
  const targetDate = report.target_date ? new Date(report.target_date) : null;
  const daysLeft = targetDate ? Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && report.status !== 'submitted';

  return (
    <td className="p-1.5 text-center">
      <button
        onClick={() => onEdit(report)}
        className={`w-full p-2 rounded-lg border transition-all hover:shadow-sm text-xs ${
          isOverdue ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <Badge className={`${statusConfig.color} text-[10px] px-1.5 py-0`}>
          {statusConfig.label}
        </Badge>
        {targetDate && (
          <div className={`text-[10px] mt-1 ${isOverdue ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
            {targetDate.toLocaleDateString('he-IL')}
          </div>
        )}
        {report.reconciliation_steps && (
          <div className="flex justify-center gap-0.5 mt-1">
            {RECONCILIATION_STEPS.map(step => (
              <div
                key={step.key}
                className={`w-2 h-2 rounded-full ${
                  report.reconciliation_steps?.[step.key] ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={step.label}
              />
            ))}
          </div>
        )}
      </button>
    </td>
  );
}

// ============================================================
// Edit Dialog
// ============================================================
function EditReportDialog({ report, open, onClose, onSave }) {
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (report) {
      setEditData({
        status: report.status || 'not_started',
        target_date: report.target_date || '',
        submission_date: report.submission_date || '',
        notes: report.notes || '',
        reconciliation_steps: report.reconciliation_steps || {
          payroll_vs_bookkeeping: false,
          periodic_vs_annual: false,
        },
      });
    }
  }, [report]);

  if (!report) return null;

  const periodConfig = PERIOD_CONFIG[report.period];
  const reportType = REPORT_TYPES[report.report_type];
  const statusConfig = getStatusConfig(editData.status);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {report.client_name}
          </DialogTitle>
          <DialogDescription>
            {reportType?.shortLabel} — {periodConfig?.label} | שנת {report.report_year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Status with color indicator */}
          <div>
            <Label className="text-sm font-semibold">סטטוס</Label>
            <Select value={editData.status} onValueChange={(v) => setEditData(p => ({ ...p, status: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target date */}
          <div>
            <Label className="text-sm font-semibold">תאריך יעד</Label>
            <Input
              type="date"
              value={editData.target_date}
              onChange={(e) => setEditData(p => ({ ...p, target_date: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Submission date */}
          {editData.status === 'submitted' && (
            <div>
              <Label className="text-sm font-semibold">תאריך שידור</Label>
              <Input
                type="date"
                value={editData.submission_date}
                onChange={(e) => setEditData(p => ({ ...p, submission_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          )}

          {/* Reconciliation steps */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">שלבי התאמה</Label>
            <div className="space-y-2">
              {RECONCILIATION_STEPS.map(step => (
                <label key={step.key} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={editData.reconciliation_steps?.[step.key] || false}
                    onCheckedChange={(checked) => setEditData(p => ({
                      ...p,
                      reconciliation_steps: { ...p.reconciliation_steps, [step.key]: checked }
                    }))}
                  />
                  <span className="text-sm">{step.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold">הערות</Label>
            <Input
              value={editData.notes}
              onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))}
              placeholder="הערות, ארכות..."
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 ml-1" /> ביטול
            </Button>
            <Button onClick={() => { onSave(report.id, editData); onClose(); }} className="bg-primary">
              <Save className="w-4 h-4 ml-1" /> שמור
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Bulk Status Update Dialog
// ============================================================
function BulkStatusDialog({ open, onClose, selectedCount, columns, onApply }) {
  const [bulkStatus, setBulkStatus] = useState('submitted');
  const [bulkColumn, setBulkColumn] = useState('');

  useEffect(() => {
    if (open && columns.length > 0 && !bulkColumn) {
      setBulkColumn(`${columns[0].typeKey}::${columns[0].period}`);
    }
  }, [open, columns]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>עדכון סטטוס מרוכז</DialogTitle>
          <DialogDescription>
            עדכון {selectedCount} לקוחות בבת אחת
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-sm font-semibold">עמודת דיווח</Label>
            <Select value={bulkColumn} onValueChange={setBulkColumn}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="בחר עמודה" /></SelectTrigger>
              <SelectContent className="bg-white">
                {columns.map(col => (
                  <SelectItem key={`${col.typeKey}::${col.period}`} value={`${col.typeKey}::${col.period}`}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">סטטוס חדש</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="outline" onClick={onClose}>ביטול</Button>
            <Button
              onClick={() => { onApply(bulkColumn, bulkStatus); onClose(); }}
              disabled={!bulkColumn}
              className="bg-primary"
            >
              <Check className="w-4 h-4 ml-1" />
              עדכן {selectedCount} לקוחות
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function PeriodicSummaryReports() {
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear() - 1));
  const [editingReport, setEditingReport] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reportsData, clientsData] = await Promise.all([
        PeriodicReport.list(null, 2000).catch(() => []),
        Client.list(null, 500).catch(() => []),
      ]);
      setReports(reportsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  // Active clients with payroll-related services (126 forms are for payroll only)
  const eligibleClients = useMemo(() =>
    clients.filter(c => {
      if (c.status !== 'active') return false;
      if (!(c.service_types || []).some(st =>
        ['payroll', 'deductions', 'social_security'].includes(st)
      )) return false;
      if (c.onboarding_year && parseInt(c.onboarding_year) > parseInt(selectedYear)) return false;
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
    [clients, selectedYear]
  );

  // Reports for selected year (must be defined before manuallyAddedClients)
  const yearReports = useMemo(() =>
    reports.filter(r => r.report_year === selectedYear),
    [reports, selectedYear]
  );

  // Clients that already have reports but aren't eligible (manually added)
  const manuallyAddedClients = useMemo(() => {
    const eligibleIds = new Set(eligibleClients.map(c => c.id));
    const reportClientIds = new Set(yearReports.map(r => r.client_id));
    return clients.filter(c => reportClientIds.has(c.id) && !eligibleIds.has(c.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  }, [clients, eligibleClients, yearReports]);

  // All displayed clients = eligible + manually added
  const allDisplayedClients = useMemo(() =>
    [...eligibleClients, ...manuallyAddedClients],
    [eligibleClients, manuallyAddedClients]
  );

  // Build a lookup: client_id -> report_type -> period -> report
  const reportLookup = useMemo(() => {
    const lookup = {};
    yearReports.forEach(r => {
      if (!lookup[r.client_id]) lookup[r.client_id] = {};
      if (!lookup[r.client_id][r.report_type]) lookup[r.client_id][r.report_type] = {};
      lookup[r.client_id][r.report_type][r.period] = r;
    });
    return lookup;
  }, [yearReports]);

  // Clients without reports for selected year
  const clientsWithoutReports = useMemo(() => {
    return eligibleClients.filter(c => !reportLookup[c.id]);
  }, [eligibleClients, reportLookup]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!search) return allDisplayedClients;
    return allDisplayedClients.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allDisplayedClients, search]);

  // Stats
  const stats = useMemo(() => {
    const total = yearReports.length;
    const submitted = yearReports.filter(r => r.status === 'submitted').length;
    const reconciling = yearReports.filter(r => r.status === 'reconciling').length;
    const overdue = yearReports.filter(r =>
      r.target_date && new Date(r.target_date) < new Date() && r.status !== 'submitted'
    ).length;
    return { total, submitted, reconciling, overdue };
  }, [yearReports]);

  const handleCreateForAllClients = async () => {
    try {
      for (const client of clientsWithoutReports) {
        // Create all report types and periods
        for (const [typeKey, typeDef] of Object.entries(REPORT_TYPES)) {
          for (const period of typeDef.periods) {
            await PeriodicReport.create({
              client_id: client.id,
              client_name: client.name,
              report_year: selectedYear,
              report_type: typeKey,
              period,
              target_date: getDefaultTargetDate(selectedYear, period),
              status: 'not_started',
              reconciliation_steps: {
                payroll_vs_bookkeeping: false,
                periodic_vs_annual: false,
              },
              submission_date: '',
              notes: '',
            });
          }
        }
      }
      await loadData();
    } catch (error) {
      console.error('Error creating reports:', error);
    }
  };

  const handleUpdateReport = async (id, data) => {
    try {
      await PeriodicReport.update(id, data);
      await loadData();
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [addClientSearch, setAddClientSearch] = useState('');

  // Delete all reports for a client in selected year
  const handleDeleteClientReports = async (clientId) => {
    const clientReports = yearReports.filter(r => r.client_id === clientId);
    if (clientReports.length === 0) return;
    if (!window.confirm(`למחוק ${clientReports.length} דיווחים ללקוח זה?`)) return;
    try {
      for (const r of clientReports) {
        await PeriodicReport.delete(r.id);
      }
      await loadData();
    } catch (error) {
      console.error('Error deleting reports:', error);
    }
  };

  // Add a client manually (create all report rows)
  const handleAddClient = async (client) => {
    try {
      for (const [typeKey, typeDef] of Object.entries(REPORT_TYPES)) {
        for (const period of typeDef.periods) {
          await PeriodicReport.create({
            client_id: client.id,
            client_name: client.name,
            report_year: selectedYear,
            report_type: typeKey,
            period,
            target_date: getDefaultTargetDate(selectedYear, period),
            status: 'not_started',
            reconciliation_steps: {
              payroll_vs_bookkeeping: false,
              periodic_vs_annual: false,
            },
            submission_date: '',
            notes: '',
          });
        }
      }
      setShowAddClientDialog(false);
      setAddClientSearch('');
      await loadData();
    } catch (error) {
      console.error('Error adding client:', error);
    }
  };

  // Clients available to add (active, not already displayed)
  const availableClientsToAdd = useMemo(() => {
    const displayedIds = new Set(allDisplayedClients.map(c => c.id));
    return clients
      .filter(c => c.status === 'active' && !displayedIds.has(c.id))
      .filter(c => !addClientSearch || c.name?.toLowerCase().includes(addClientSearch.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  }, [clients, allDisplayedClients, addClientSearch]);

  const handleToggleClient = (clientId) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleBulkStatusUpdate = async (columnKey, newStatus) => {
    // columnKey format: "typeKey::period" using :: as separator
    const [typeKey, period] = columnKey.split('::');

    try {
      for (const clientId of selectedClientIds) {
        const report = reportLookup[clientId]?.[typeKey]?.[period];
        if (report) {
          await PeriodicReport.update(report.id, { status: newStatus });
        }
      }
      setSelectedClientIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error in bulk update:', error);
    }
  };

  // Column definitions for the table
  const columns = [];
  for (const [typeKey, typeDef] of Object.entries(REPORT_TYPES)) {
    for (const period of typeDef.periods) {
      columns.push({
        typeKey,
        period,
        label: `${typeDef.shortLabel} - ${PERIOD_CONFIG[period].shortLabel}`,
        targetLabel: period === 'h1'
          ? `18/07/${selectedYear}`
          : period === 'h2'
            ? `18/01/${parseInt(selectedYear) + 1}`
            : `30/04/${parseInt(selectedYear) + 1}`,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 backdrop-blur-xl bg-white/45 border border-white/20 shadow-xl rounded-[32px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-full">
            <FileText className="w-8 h-8 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">דיווחים מרכזים תקופתיים</h1>
            <p className="text-sm text-gray-600">מעקב טפסי 126 — ביטוח לאומי ומ"ה ניכויים</p>
          </div>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-xl font-bold min-w-[60px] text-center">{selectedYear}</span>
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">סה״כ דיווחים</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">שודרו</p>
            <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">בהתאמות</p>
            <p className="text-2xl font-bold text-amber-600">{stats.reconciling}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">באיחור</p>
            <p className="text-2xl font-bold text-amber-600">{stats.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">התקדמות:</span>
          <Progress value={stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0} className="flex-1 h-2" />
          <span className="text-sm font-semibold">{Math.round(stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0)}%</span>
        </div>
      )}

      {/* Create button */}
      {clientsWithoutReports.length > 0 && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{clientsWithoutReports.length} לקוחות ללא דיווחים לשנת {selectedYear}</p>
              <p className="text-sm text-muted-foreground">
                ייווצרו: 126 בל (מחצית 1, מחצית 2, שנתי) + 126 מ"ה (שנתי) לכל לקוח
              </p>
            </div>
            <Button onClick={handleCreateForAllClients} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              צור דיווחים ל-{clientsWithoutReports.length} לקוחות
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search + Add + Bulk actions */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddClientDialog(true)}>
          <UserPlus className="w-4 h-4" /> הוסף לקוח
        </Button>

        {selectedClientIds.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">{selectedClientIds.size} נבחרו</span>
            <Button size="sm" variant="outline" onClick={() => setSelectedClientIds(new Set())} className="h-7 text-xs">
              בטל
            </Button>
            <Button size="sm" onClick={() => setShowBulkDialog(true)} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              עדכן סטטוס
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <ResizableTable className="w-full text-sm" stickyHeader maxHeight="70vh">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-center p-2 w-10 sticky right-0 bg-gray-100 z-30">
                    <Checkbox
                      checked={filteredClients.length > 0 && selectedClientIds.size === filteredClients.length}
                      onCheckedChange={handleToggleAll}
                    />
                  </th>
                  <th className="text-right p-3 font-semibold sticky right-10 bg-gray-100 z-30 min-w-[160px] border-l">
                    לקוח
                  </th>
                  {columns.map(col => (
                    <th key={`${col.typeKey}_${col.period}`} className="text-center p-2 font-semibold min-w-[110px] bg-gray-100">
                      <div className="text-xs">{col.label}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">יעד: {col.targetLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, idx) => {
                  const clientReports = reportLookup[client.id] || {};
                  const isSelected = selectedClientIds.has(client.id);
                  return (
                    <tr key={client.id} className={`group border-b ${isSelected ? 'bg-blue-50/50' : idx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-muted/30`}>
                      <td className="text-center p-2 sticky right-0 bg-white z-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleClient(client.id)}
                        />
                      </td>
                      <td className="p-3 font-medium sticky right-10 bg-white z-10 border-l">
                        <div className="flex items-center gap-2">
                          <span className="flex-1">{client.name}</span>
                          <button
                            onClick={() => handleDeleteClientReports(client.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-amber-500 transition-all p-0.5"
                            title="מחק דיווחים ללקוח"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      {columns.map(col => (
                        <ReportCell
                          key={`${col.typeKey}_${col.period}`}
                          report={clientReports[col.typeKey]?.[col.period]}
                          onEdit={setEditingReport}
                        />
                      ))}
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="p-8 text-center text-muted-foreground">
                      {search ? 'לא נמצאו לקוחות' : 'אין לקוחות עם שירותי שכר/ניכויים'}
                    </td>
                  </tr>
                )}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {STATUS_OPTIONS.map(s => (
          <div key={s.value} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className="text-gray-600">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 mr-4">
          <div className="flex gap-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
          <span className="text-gray-600">שלבי התאמה (ירוק = בוצע)</span>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditReportDialog
        report={editingReport}
        open={!!editingReport}
        onClose={() => setEditingReport(null)}
        onSave={handleUpdateReport}
      />

      {/* Bulk Status Dialog */}
      <BulkStatusDialog
        open={showBulkDialog}
        onClose={() => setShowBulkDialog(false)}
        selectedCount={selectedClientIds.size}
        columns={columns}
        onApply={handleBulkStatusUpdate}
      />

      {/* Add Client Dialog */}
      <Dialog open={showAddClientDialog} onOpenChange={(open) => { setShowAddClientDialog(open); if (!open) setAddClientSearch(''); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>הוספת לקוח לדיווחים מרכזים</DialogTitle>
            <DialogDescription>בחר לקוח להוספה לטבלת דיווחי 126 לשנת {selectedYear}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לקוח..."
                value={addClientSearch}
                onChange={(e) => setAddClientSearch(e.target.value)}
                className="pr-10"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
              {availableClientsToAdd.slice(0, 30).map(client => (
                <button
                  key={client.id}
                  onClick={() => handleAddClient(client)}
                  className="w-full text-right px-3 py-2 rounded-md hover:bg-primary/10 transition-colors text-sm"
                >
                  {client.name}
                </button>
              ))}
              {availableClientsToAdd.length === 0 && (
                <p className="text-center text-gray-400 py-4 text-sm">לא נמצאו לקוחות</p>
              )}
              {availableClientsToAdd.length > 30 && (
                <p className="text-center text-gray-400 py-2 text-xs">
                  מציג 30 מתוך {availableClientsToAdd.length} — חפש לצמצום
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
