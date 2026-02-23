
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountReconciliation, Client, ClientAccount, Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  BookCheck, Plus, CheckCircle, Clock, AlertCircle, Landmark, CreditCard,
  AlertTriangle, Calendar, Search, BookUser, Building2, ChevronDown, ChevronUp,
  ArrowUpDown, Loader, ExternalLink
} from 'lucide-react';

// ─── Status Configuration — Glassmorphism Pill Styles ──────────
const statusConfig = {
  not_started:            { label: 'לא התחיל',       pill: 'bg-white/40 text-gray-700 border border-white/30 backdrop-blur-sm', icon: Clock },
  waiting_for_materials:  { label: 'ממתין לחומרים',   pill: 'bg-amber-100/80 text-amber-800 border border-amber-200',            icon: AlertCircle },
  in_progress:            { label: 'בתהליך',          pill: 'bg-sky-100/80 text-sky-800 border border-sky-200',                  icon: Clock },
  completed:              { label: 'הושלם',           pill: 'bg-teal-100/80 text-teal-800 border border-teal-200',               icon: CheckCircle },
  issues:                 { label: 'בעיות',           pill: 'bg-rose-100/80 text-rose-800 border border-rose-200',               icon: AlertCircle },
};

const frequencyLabels = {
  monthly: 'חודשי', bimonthly: 'דו-חודשי', quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי', yearly: 'שנתי',
};

const frequencyMonths = {
  monthly: 1, bimonthly: 2, quarterly: 3, semi_annual: 6, yearly: 12,
};

const accountTypeIcons = {
  bank: Landmark, credit_card: CreditCard, bookkeeping: BookUser, clearing: Building2,
};
const accountTypeLabels = {
  bank: 'בנק', credit_card: 'אשראי', bookkeeping: 'הנה"ח', clearing: 'סליקה',
};

function calcNextDate(lastDate, frequency) {
  if (!lastDate) return null;
  const months = frequencyMonths[frequency] || 1;
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function getDaysOverdue(nextDate) {
  if (!nextDate) return 0;
  const diff = Date.now() - new Date(nextDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('he-IL');
}

// ─── Sortable Table Header ──────────────────────────────────────
function SortableHeader({ label, sortKey, currentSort, onSort }) {
  const isActive = currentSort.key === sortKey;
  const isAsc = currentSort.dir === 'asc';

  return (
    <th
      className="p-3 font-bold text-white cursor-pointer select-none hover:brightness-110 transition-all"
      style={{ backgroundColor: '#008291' }}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span>{label}</span>
        {isActive ? (
          isAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </div>
    </th>
  );
}

// ─── Client Drawer ──────────────────────────────────────────────
function ClientDrawer({ client, tasks, open, onClose }) {
  if (!client) return null;
  const clientTasks = tasks.filter(t =>
    t.client_name === client.name && t.status !== 'completed' && t.status !== 'not_relevant'
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[400px] backdrop-blur-xl bg-white/60 border-l border-white/20 rounded-l-[32px]">
        <SheetHeader className="text-right">
          <SheetTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#008291]" />
            {client.nickname || client.name}
          </SheetTitle>
          <SheetDescription className="text-right text-sm text-gray-500">
            {clientTasks.length} משימות פעילות
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {clientTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">אין משימות פעילות ללקוח זה</p>
          ) : (
            clientTasks.map(task => (
              <div key={task.id} className="p-3 bg-white/70 rounded-[16px] shadow-sm border border-white/30">
                <p className="font-medium text-sm text-gray-800">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-[10px] rounded-full px-2 ${statusConfig[task.status]?.pill || statusConfig.not_started.pill}`}>
                    {statusConfig[task.status]?.label || task.status}
                  </Badge>
                  {task.due_date && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" /> {formatDate(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────
function ReconciliationEditDialog({ reconciliation, clients, open, onClose, onSave }) {
  const [formData, setFormData] = useState({
    client_id: '', client_account_id: '', period: '',
    reconciliation_type: 'bank_credit', status: 'not_started',
    due_date: '', notes: '',
  });
  const [clientAccounts, setClientAccounts] = useState([]);

  useEffect(() => {
    if (reconciliation) {
      setFormData({
        client_id: reconciliation.client_id || '',
        client_account_id: reconciliation.client_account_id || '',
        period: reconciliation.period || '',
        reconciliation_type: reconciliation.reconciliation_type || 'bank_credit',
        status: reconciliation.status || 'not_started',
        due_date: reconciliation.due_date || '',
        notes: reconciliation.notes || '',
      });
    } else {
      setFormData({
        client_id: '', client_account_id: '', period: '',
        reconciliation_type: 'bank_credit', status: 'not_started',
        due_date: '', notes: '',
      });
    }
  }, [reconciliation]);

  useEffect(() => {
    if (formData.client_id) {
      ClientAccount.filter({ client_id: formData.client_id }).then(accs => setClientAccounts(accs || [])).catch(() => setClientAccounts([]));
    } else {
      setClientAccounts([]);
    }
  }, [formData.client_id]);

  const handleSubmit = () => {
    const selectedClient = clients.find(c => c.id === formData.client_id);
    const selectedAccount = clientAccounts.find(a => a.id === formData.client_account_id);
    onSave({
      ...(reconciliation || {}),
      ...formData,
      client_name: selectedClient?.name,
      account_name: selectedAccount?.account_name || 'חשבון כללי',
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="backdrop-blur-xl bg-white/80 border-white/30 rounded-[24px] max-w-lg">
        <DialogHeader>
          <DialogTitle>{reconciliation?.id ? 'עריכת התאמה' : 'הוספת התאמה חדשה'}</DialogTitle>
          <DialogDescription>פרטי התאמת חשבון</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>לקוח</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v, client_account_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent className="bg-white">{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>חשבון</Label>
              <Select value={formData.client_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_account_id: v }))} disabled={clientAccounts.length === 0}>
                <SelectTrigger><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
                <SelectContent className="bg-white">{clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>תקופה</Label>
              <Input value={formData.period} onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))} placeholder="ינואר 2026" />
            </div>
            <div>
              <Label>סוג</Label>
              <Select value={formData.reconciliation_type} onValueChange={(v) => setFormData(prev => ({ ...prev, reconciliation_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="bank_credit">בנק/אשראי</SelectItem>
                  <SelectItem value="internal">פנימי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סטטוס</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {Object.entries(statusConfig).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תאריך יעד</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="הערות..." className="min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSubmit} className="bg-[#008291] hover:bg-[#006d7a] text-white">שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function ReconciliationsPage() {
  const [reconciliations, setReconciliations] = useState([]);
  const [clients, setClients] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRec, setEditingRec] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [drawerClient, setDrawerClient] = useState(null);

  // Sorting state
  const [sort, setSort] = useState({ key: 'daysOverdue', dir: 'desc' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recsData, clientsData, accountsData, tasksData] = await Promise.all([
        AccountReconciliation.list(null, 500).catch(() => []),
        Client.list(null, 500).catch(() => []),
        ClientAccount.list(null, 2000).catch(() => []),
        Task.list(null, 5000).catch(() => []),
      ]);
      setReconciliations(recsData || []);
      setClients((clientsData || []).filter(c => c.status === 'active'));
      setAllAccounts(accountsData || []);
      setAllTasks(tasksData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      await ClientAccount.update(accountId, updates);
      loadData();
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  const handleSaveReconciliation = async (data) => {
    try {
      if (data.id) {
        await AccountReconciliation.update(data.id, data);
      } else {
        await AccountReconciliation.create(data);
      }
      setShowEditDialog(false);
      setEditingRec(null);
      loadData();
    } catch (error) {
      console.error("Error saving reconciliation:", error);
    }
  };

  const handleSort = useCallback((key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Build client map
  const clientMap = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  // Build enriched rows
  const rows = useMemo(() => {
    return allAccounts
      .filter(acc => {
        const client = clientMap[acc.client_id];
        if (!client) return false;
        if (acc.account_status === 'inactive') return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (!client.name?.toLowerCase().includes(term) && !acc.account_name?.toLowerCase().includes(term)) return false;
        }
        return true;
      })
      .map(acc => {
        const client = clientMap[acc.client_id];
        const nextDate = acc.next_reconciliation_due || calcNextDate(acc.last_reconciliation_date, acc.reconciliation_frequency);
        const daysOverdue = getDaysOverdue(nextDate);
        const accountRecs = reconciliations
          .filter(r => r.client_account_id === acc.id)
          .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
        const latestRec = accountRecs[0];
        const latestStatus = latestRec?.status || 'not_started';

        return {
          id: acc.id,
          clientName: client.name,
          client,
          accountName: acc.account_name || acc.bank_name || '-',
          accountType: acc.account_type,
          frequency: acc.reconciliation_frequency,
          lastDate: acc.last_reconciliation_date,
          nextDate,
          daysOverdue,
          latestStatus,
          latestRec,
          account: acc,
        };
      });
  }, [allAccounts, clientMap, reconciliations, searchTerm]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sort.key) {
        case 'clientName': return dir * (a.clientName || '').localeCompare(b.clientName || '');
        case 'accountName': return dir * (a.accountName || '').localeCompare(b.accountName || '');
        case 'accountType': return dir * (a.accountType || '').localeCompare(b.accountType || '');
        case 'frequency': return dir * ((frequencyMonths[a.frequency] || 1) - (frequencyMonths[b.frequency] || 1));
        case 'lastDate': return dir * (a.lastDate || '').localeCompare(b.lastDate || '');
        case 'nextDate': return dir * (a.nextDate || '').localeCompare(b.nextDate || '');
        case 'daysOverdue': return dir * (a.daysOverdue - b.daysOverdue);
        case 'latestStatus': return dir * (a.latestStatus || '').localeCompare(b.latestStatus || '');
        default: return 0;
      }
    });
    return sorted;
  }, [rows, sort]);

  // Stats
  const overdueCount = rows.filter(r => r.daysOverdue > 0).length;
  const completedCount = rows.filter(r => r.latestStatus === 'completed').length;
  const pendingCount = rows.filter(r => r.latestStatus !== 'completed').length;

  return (
    <div className="space-y-6 p-4 md:p-6 backdrop-blur-xl bg-white/45 border border-white/20 shadow-xl rounded-[32px]" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(0,130,145,0.15)' }}>
            <BookCheck className="w-8 h-8 text-[#008291]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">התאמות חשבונות</h1>
            <p className="text-gray-500 text-sm">מעקב ובקרה על כל ההתאמות</p>
          </div>
        </div>
        <Button className="bg-[#008291] hover:bg-[#006d7a] text-white rounded-[16px]" onClick={() => { setEditingRec(null); setShowEditDialog(true); }}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף התאמה
        </Button>
      </div>

      {/* Summary Cards — glass style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-[#008291]">{rows.length}</div>
          <div className="text-xs text-gray-500">חשבונות פעילים</div>
        </div>
        <div className={`p-4 rounded-[20px] backdrop-blur-sm border shadow-sm ${overdueCount > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-white/50 border-white/30'}`}>
          <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-amber-600' : 'text-[#008291]'}`}>{overdueCount}</div>
          <div className="text-xs text-gray-500">בפיגור</div>
        </div>
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-sky-600">{pendingCount}</div>
          <div className="text-xs text-gray-500">פתוחות</div>
        </div>
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-teal-600">{completedCount}</div>
          <div className="text-xs text-gray-500">הושלמו</div>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="bg-amber-50/60 backdrop-blur-sm border border-amber-200 rounded-[16px] p-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{overdueCount} חשבונות בפיגור התאמה!</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לקוח או חשבון..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 rounded-[16px] bg-white/60 border-white/30 backdrop-blur-sm"
        />
      </div>

      {/* Dynamic Sortable Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-8 h-8 animate-spin text-[#008291]" />
          <span className="mr-3 text-gray-500">טוען נתונים...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-white/30 shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <SortableHeader label="לקוח" sortKey="clientName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="חשבון" sortKey="accountName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="סוג" sortKey="accountType" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="תדירות" sortKey="frequency" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="התאמה אחרונה" sortKey="lastDate" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="התאמה הבאה" sortKey="nextDate" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="פיגור (ימים)" sortKey="daysOverdue" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="סטטוס" sortKey="latestStatus" currentSort={sort} onSort={handleSort} />
                <th className="p-3 font-bold text-white text-center" style={{ backgroundColor: '#008291' }}>פעולה</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <BookCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    אין חשבונות להצגה
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const AccIcon = accountTypeIcons[row.accountType] || Landmark;
                  const stsCfg = statusConfig[row.latestStatus] || statusConfig.not_started;
                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`border-b border-white/20 cursor-pointer transition-colors ${
                        row.daysOverdue > 0 ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'bg-white/20 hover:bg-white/40'
                      }`}
                      onClick={() => setDrawerClient(row.client)}
                    >
                      <td className="p-3 font-medium text-gray-800">{row.clientName}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <AccIcon className="w-4 h-4 text-[#008291]" />
                          <span className="text-gray-700">{row.accountName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="text-[10px] rounded-full bg-white/50 text-gray-600 border border-white/30">
                          {accountTypeLabels[row.accountType] || row.accountType}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="text-[10px] rounded-full bg-white/50 text-gray-600 border border-white/30">
                          {frequencyLabels[row.frequency] || 'חודשי'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-xs text-gray-600">{formatDate(row.lastDate)}</td>
                      <td className="p-3 text-center text-xs text-gray-600">{formatDate(row.nextDate)}</td>
                      <td className="p-3 text-center">
                        {row.daysOverdue > 0 ? (
                          <span className="text-xs font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-full">
                            {row.daysOverdue} ימים
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`text-[10px] rounded-full px-2.5 py-0.5 ${stsCfg.pill}`}>
                          {stsCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] gap-1 rounded-full bg-white/50 border-white/30 hover:bg-teal-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            const today = new Date().toISOString().split('T')[0];
                            const newNext = calcNextDate(today, row.frequency);
                            handleUpdateAccount(row.id, {
                              last_reconciliation_date: today,
                              next_reconciliation_due: newNext,
                            });
                          }}
                        >
                          <CheckCircle className="w-3 h-3 text-teal-600" /> סמן הושלם
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Drawer */}
      <ClientDrawer
        client={drawerClient}
        tasks={allTasks}
        open={!!drawerClient}
        onClose={() => setDrawerClient(null)}
      />

      {/* Edit Dialog */}
      <ReconciliationEditDialog
        reconciliation={editingRec}
        clients={clients}
        open={showEditDialog}
        onClose={() => { setShowEditDialog(false); setEditingRec(null); }}
        onSave={handleSaveReconciliation}
      />
    </div>
  );
}
