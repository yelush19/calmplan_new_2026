
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountReconciliation, Client, ClientAccount, Task } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  BookCheck, Plus, CheckCircle, Clock, AlertCircle, Landmark, CreditCard,
  AlertTriangle, Calendar, Search, BookUser, Building2, ChevronDown, ChevronUp,
  ArrowUpDown, Loader, ExternalLink, Zap, Filter, Users, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Status Configuration — Glassmorphism Pill Styles ──────────
const statusConfig = {
  not_started:            { label: 'לא התחיל',       pill: 'bg-white/40 text-slate-700 border border-white/30 backdrop-blur-sm', icon: Clock },
  waiting_for_materials:  { label: 'ממתין לחומרים',   pill: 'bg-amber-100/80 text-amber-800 border border-amber-200',            icon: AlertCircle },
  in_progress:            { label: 'בתהליך',          pill: 'bg-[#00acc1]/15 text-[#00acc1] border border-[#00acc1]/30',         icon: Clock },
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

// ─── Lag severity thresholds ───────────────────────────────────
function getLagSeverity(days) {
  if (days <= 0) return 'ok';
  if (days <= 14) return 'low';
  if (days <= 30) return 'medium';
  if (days <= 60) return 'high';
  return 'critical';
}

const lagSeverityConfig = {
  ok:       { dot: 'bg-teal-400',  glow: '',                                                    text: 'text-teal-600' },
  low:      { dot: 'bg-sky-400',   glow: '',                                                    text: 'text-sky-600' },
  medium:   { dot: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]',               text: 'text-amber-600' },
  high:     { dot: 'bg-orange-500',glow: 'shadow-[0_0_10px_rgba(249,115,22,0.6)]',              text: 'text-orange-600' },
  critical: { dot: 'bg-rose-500',  glow: 'shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse', text: 'text-rose-600' },
};

// ─── Pre-set lag filter options ────────────────────────────────
const LAG_FILTER_OPTIONS = [
  { key: 'all',  label: 'הכל',       minDays: 0 },
  { key: '14',   label: '> 14 ימים', minDays: 14 },
  { key: '30',   label: '> 30 ימים', minDays: 30 },
  { key: '60',   label: '> 60 ימים', minDays: 60 },
];

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
          <SheetDescription className="text-right text-sm text-slate-500">
            {clientTasks.length} משימות פעילות
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {clientTasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">אין משימות פעילות ללקוח זה</p>
          ) : (
            clientTasks.map(task => (
              <div key={task.id} className="p-3 bg-white/70 backdrop-blur-sm rounded-[16px] shadow-sm border border-white/30">
                <p className="font-medium text-sm text-slate-800">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-[10px] rounded-full px-2 ${statusConfig[task.status]?.pill || statusConfig.not_started.pill}`}>
                    {statusConfig[task.status]?.label || task.status}
                  </Badge>
                  {task.due_date && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
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

// ─── Bulk Action Dialog ─────────────────────────────────────────
function BulkActionDialog({ open, onClose, selectedCount, onApply }) {
  const [bulkDate, setBulkDate] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  const handleApply = () => {
    const updates = {};
    if (bulkDate) {
      updates.last_reconciliation_date = bulkDate;
    }
    if (bulkStatus) {
      updates.status = bulkStatus;
    }
    if (Object.keys(updates).length > 0) {
      onApply(updates);
    }
    setBulkDate('');
    setBulkStatus('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="backdrop-blur-xl bg-white/80 border-white/30 rounded-[24px] max-w-md">
        <DialogHeader>
          <DialogTitle>עדכון גורף</DialogTitle>
          <DialogDescription>עדכון {selectedCount} חשבונות נבחרים בפעולה אחת</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div>
            <Label>תאריך התאמה חדש</Label>
            <Input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="rounded-[16px] bg-white/60 border-white/30 backdrop-blur-sm mt-1"
            />
          </div>
          <div>
            <Label>סטטוס חדש</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="rounded-[16px] bg-white/60 border-white/30 backdrop-blur-sm mt-1">
                <SelectValue placeholder="ללא שינוי" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/30 rounded-[16px]">
                {Object.entries(statusConfig).map(([k, c]) => (
                  <SelectItem key={k} value={k}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-[12px]">ביטול</Button>
          <Button
            onClick={handleApply}
            className="bg-[#008291] hover:bg-[#006d7a] text-white rounded-[12px]"
            disabled={!bulkDate && !bulkStatus}
          >
            עדכן {selectedCount} חשבונות
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
                <SelectTrigger className="rounded-[12px] bg-white/60 border-white/30"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/30 rounded-[12px]">{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>חשבון</Label>
              <Select value={formData.client_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_account_id: v }))} disabled={clientAccounts.length === 0}>
                <SelectTrigger className="rounded-[12px] bg-white/60 border-white/30"><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/30 rounded-[12px]">{clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>תקופה</Label>
              <Input value={formData.period} onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))} placeholder="ינואר 2026" className="rounded-[12px] bg-white/60 border-white/30" />
            </div>
            <div>
              <Label>סוג</Label>
              <Select value={formData.reconciliation_type} onValueChange={(v) => setFormData(prev => ({ ...prev, reconciliation_type: v }))}>
                <SelectTrigger className="rounded-[12px] bg-white/60 border-white/30"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/30 rounded-[12px]">
                  <SelectItem value="bank_credit">בנק/אשראי</SelectItem>
                  <SelectItem value="internal">פנימי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סטטוס</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="rounded-[12px] bg-white/60 border-white/30"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/30 rounded-[12px]">
                  {Object.entries(statusConfig).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תאריך יעד</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))} className="rounded-[12px] bg-white/60 border-white/30" />
            </div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="הערות..." className="min-h-[60px] rounded-[12px] bg-white/60 border-white/30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-[12px]">ביטול</Button>
          <Button onClick={handleSubmit} className="bg-[#008291] hover:bg-[#006d7a] text-white rounded-[12px]">שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Group Accordion Header ──────────────────────────────
function ClientGroupHeader({
  clientName, client, accounts, isExpanded, onToggle,
  isSelected, onSelectClient, onOpenDrawer,
}) {
  const totalAccounts = accounts.length;
  const laggingCount = accounts.filter(r => r.daysOverdue > 0).length;
  const completedCount = accounts.filter(r => r.latestStatus === 'completed').length;
  const worstLag = Math.max(0, ...accounts.map(r => r.daysOverdue));
  const worstSeverity = getLagSeverity(worstLag);

  return (
    <div
      className={`flex items-center justify-between p-3 cursor-pointer transition-all rounded-[16px] ${
        isExpanded
          ? 'bg-white/50 backdrop-blur-sm border border-white/30 shadow-sm'
          : 'hover:bg-white/30'
      }`}
    >
      <div className="flex items-center gap-3 flex-1" onClick={onToggle}>
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectClient(clientName)}
            className="border-[#008291]/50"
          />
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-[#008291]" />
        </motion.div>
        <button
          className="font-bold text-slate-800 text-sm hover:text-[#008291] transition-colors text-right"
          onClick={(e) => { e.stopPropagation(); onOpenDrawer(client); }}
        >
          {clientName}
        </button>
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] rounded-full bg-[#008291]/10 text-[#008291] border border-[#008291]/20 px-2">
            {totalAccounts} חשבונות
          </Badge>
          {laggingCount > 0 && (
            <Badge className={`text-[10px] rounded-full px-2 ${
              worstSeverity === 'critical' || worstSeverity === 'high'
                ? 'bg-rose-100/80 text-rose-700 border border-rose-200'
                : 'bg-amber-100/80 text-amber-700 border border-amber-200'
            }`}>
              {laggingCount} בפיגור
            </Badge>
          )}
          {completedCount === totalAccounts && totalAccounts > 0 && (
            <Badge className="text-[10px] rounded-full bg-teal-100/80 text-teal-700 border border-teal-200 px-2">
              הכל מעודכן
            </Badge>
          )}
        </div>
      </div>
    </div>
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

  // Sorting
  const [sort, setSort] = useState({ key: 'daysOverdue', dir: 'desc' });

  // Lag filter
  const [lagFilter, setLagFilter] = useState('all');
  const [customLagDays, setCustomLagDays] = useState('');

  // Accordion state — expanded client groups
  const [expandedClients, setExpandedClients] = useState(new Set());

  // Selection state for bulk actions
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);

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
      await loadData();
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  };

  const handleBulkUpdate = async (updates) => {
    try {
      const promises = Array.from(selectedAccounts).map(accountId => {
        const row = rows.find(r => r.id === accountId);
        const updateData = { ...updates };
        if (updates.last_reconciliation_date && row) {
          updateData.next_reconciliation_due = calcNextDate(updates.last_reconciliation_date, row.frequency);
        }
        return ClientAccount.update(accountId, updateData);
      });
      await Promise.all(promises);
      setSelectedAccounts(new Set());
      loadData();
    } catch (error) {
      console.error("Error in bulk update:", error);
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

  // Effective lag filter threshold
  const lagThreshold = useMemo(() => {
    if (lagFilter === 'custom' && customLagDays) return parseInt(customLagDays, 10) || 0;
    const preset = LAG_FILTER_OPTIONS.find(o => o.key === lagFilter);
    return preset ? preset.minDays : 0;
  }, [lagFilter, customLagDays]);

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
          clientId: client.id,
          client,
          accountName: acc.account_name || acc.bank_name || '-',
          accountType: acc.account_type,
          frequency: acc.reconciliation_frequency,
          lastDate: acc.last_reconciliation_date,
          nextDate,
          daysOverdue,
          lagSeverity: getLagSeverity(daysOverdue),
          latestStatus,
          latestRec,
          account: acc,
        };
      })
      .filter(row => {
        // Apply lag filter
        if (lagThreshold > 0) return row.daysOverdue >= lagThreshold;
        return true;
      });
  }, [allAccounts, clientMap, reconciliations, searchTerm, lagThreshold]);

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

  // Group rows by client
  const clientGroups = useMemo(() => {
    const groups = {};
    sortedRows.forEach(row => {
      if (!groups[row.clientName]) {
        groups[row.clientName] = { client: row.client, rows: [] };
      }
      groups[row.clientName].rows.push(row);
    });
    // Sort groups by client name
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedRows]);

  // Stats
  const overdueCount = rows.filter(r => r.daysOverdue > 0).length;
  const completedCount = rows.filter(r => r.latestStatus === 'completed').length;
  const pendingCount = rows.filter(r => r.latestStatus !== 'completed').length;
  const totalClients = clientGroups.length;

  // ─── Selection helpers ──────────────────────────────────────────
  const toggleAccountSelection = useCallback((accountId) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }, []);

  const toggleClientSelection = useCallback((clientName) => {
    const group = clientGroups.find(([name]) => name === clientName);
    if (!group) return;
    const clientAccountIds = group[1].rows.map(r => r.id);
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      const allSelected = clientAccountIds.every(id => next.has(id));
      if (allSelected) {
        clientAccountIds.forEach(id => next.delete(id));
      } else {
        clientAccountIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [clientGroups]);

  const toggleSelectAll = useCallback(() => {
    const allIds = rows.map(r => r.id);
    setSelectedAccounts(prev => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }, [rows]);

  const isClientSelected = useCallback((clientName) => {
    const group = clientGroups.find(([name]) => name === clientName);
    if (!group) return false;
    return group[1].rows.every(r => selectedAccounts.has(r.id));
  }, [clientGroups, selectedAccounts]);

  // ─── Accordion toggle ──────────────────────────────────────────
  const toggleExpanded = useCallback((clientName) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientName)) next.delete(clientName);
      else next.add(clientName);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedClients(new Set(clientGroups.map(([name]) => name)));
  }, [clientGroups]);

  const collapseAll = useCallback(() => {
    setExpandedClients(new Set());
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6 backdrop-blur-xl bg-white/45 border border-white/20 shadow-xl rounded-[32px]" dir="rtl">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(0,130,145,0.15)' }}>
            <BookCheck className="w-8 h-8 text-[#008291]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">התאמות חשבונות</h1>
            <p className="text-slate-500 text-sm">מרכז שליטה — מעקב ובקרה מאורגן</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedAccounts.size > 0 && (
            <Button
              className="bg-[#00acc1] hover:bg-[#0097a7] text-white rounded-[16px] gap-1.5"
              onClick={() => setShowBulkDialog(true)}
            >
              <RefreshCw className="w-4 h-4" />
              עדכון גורף ({selectedAccounts.size})
            </Button>
          )}
          <Button
            className="bg-[#008291] hover:bg-[#006d7a] text-white rounded-[16px]"
            onClick={() => { setEditingRec(null); setShowEditDialog(true); }}
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף התאמה
          </Button>
        </div>
      </div>

      {/* ── Summary Cards — glass style ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-[#008291]">{totalClients}</div>
          <div className="text-xs text-slate-500">לקוחות פעילים</div>
        </div>
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-[#008291]">{rows.length}</div>
          <div className="text-xs text-slate-500">חשבונות פעילים</div>
        </div>
        <div className={`p-4 rounded-[20px] backdrop-blur-sm border shadow-sm ${overdueCount > 0 ? 'bg-amber-50/60 border-amber-200/50' : 'bg-white/50 border-white/30'}`}>
          <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-amber-600' : 'text-[#008291]'}`}>{overdueCount}</div>
          <div className="text-xs text-slate-500">בפיגור</div>
        </div>
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-[#00acc1]">{pendingCount}</div>
          <div className="text-xs text-slate-500">פתוחות</div>
        </div>
        <div className="p-4 rounded-[20px] backdrop-blur-sm bg-white/50 border border-white/30 shadow-sm">
          <div className="text-2xl font-bold text-teal-600">{completedCount}</div>
          <div className="text-xs text-slate-500">הושלמו</div>
        </div>
      </div>

      {/* ── Overdue Alert ───────────────────────────────────────── */}
      {overdueCount > 0 && (
        <div className="bg-amber-50/60 backdrop-blur-sm border border-amber-200/50 rounded-[16px] p-3 flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{overdueCount} חשבונות בפיגור התאמה!</span>
        </div>
      )}

      {/* ── Filter & Search Bar — glass container ───────────────── */}
      <div className="backdrop-blur-xl bg-white/45 border border-white/20 rounded-[24px] p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Lag Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[#008291]" />
            <span className="text-xs font-medium text-slate-600 ml-1">סינון פיגור:</span>
            {LAG_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setLagFilter(opt.key); setCustomLagDays(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  lagFilter === opt.key
                    ? 'bg-[#008291] text-white shadow-md'
                    : 'bg-white/50 text-slate-600 border border-white/30 hover:bg-white/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLagFilter('custom')}
                className={`px-3 py-1.5 rounded-r-full text-xs font-medium transition-all ${
                  lagFilter === 'custom'
                    ? 'bg-[#008291] text-white shadow-md'
                    : 'bg-white/50 text-slate-600 border border-white/30 hover:bg-white/70'
                }`}
              >
                מותאם
              </button>
              {lagFilter === 'custom' && (
                <Input
                  type="number"
                  min="1"
                  value={customLagDays}
                  onChange={(e) => setCustomLagDays(e.target.value)}
                  placeholder="ימים"
                  className="w-20 h-8 text-xs rounded-l-full rounded-r-none bg-white/60 border-white/30 backdrop-blur-sm"
                />
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md mr-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="חיפוש לקוח או חשבון..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 rounded-[16px] bg-white/60 border-white/30 backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Expand/Collapse + Select All controls ─────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedAccounts.size === rows.length && rows.length > 0}
            onCheckedChange={toggleSelectAll}
            className="border-[#008291]/50"
          />
          <span className="text-xs text-slate-500">
            {selectedAccounts.size > 0
              ? `${selectedAccounts.size} נבחרו`
              : 'בחר הכל'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-[#008291] hover:underline"
          >
            פרוס הכל
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-[#008291] hover:underline"
          >
            כווץ הכל
          </button>
        </div>
      </div>

      {/* ── Client-Grouped Accordion Table ───────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-8 h-8 animate-spin text-[#008291]" />
          <span className="mr-3 text-slate-500">טוען נתונים...</span>
        </div>
      ) : clientGroups.length === 0 ? (
        <div className="text-center py-16 backdrop-blur-sm bg-white/30 rounded-[24px] border border-white/20">
          <BookCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 text-sm">אין חשבונות להצגה</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientGroups.map(([clientName, { client, rows: clientRows }]) => {
            const isExpanded = expandedClients.has(clientName);

            return (
              <motion.div
                key={clientName}
                layout
                className="backdrop-blur-xl bg-white/45 border border-white/20 rounded-[24px] shadow-sm overflow-hidden"
              >
                {/* Client Accordion Header */}
                <ClientGroupHeader
                  clientName={clientName}
                  client={client}
                  accounts={clientRows}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpanded(clientName)}
                  isSelected={isClientSelected(clientName)}
                  onSelectClient={toggleClientSelection}
                  onOpenDrawer={setDrawerClient}
                />

                {/* Expandable Account Rows */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 w-10" style={{ backgroundColor: '#008291' }}></th>
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
                            {clientRows.map((row, idx) => {
                              const AccIcon = accountTypeIcons[row.accountType] || Landmark;
                              const stsCfg = statusConfig[row.latestStatus] || statusConfig.not_started;
                              const severity = lagSeverityConfig[row.lagSeverity];
                              const isChecked = selectedAccounts.has(row.id);

                              return (
                                <motion.tr
                                  key={row.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.03 }}
                                  className={`border-b border-white/20 transition-colors ${
                                    isChecked
                                      ? 'bg-[#008291]/5'
                                      : row.daysOverdue > 30
                                        ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                        : row.daysOverdue > 0
                                          ? 'bg-amber-50/20 hover:bg-amber-50/40'
                                          : 'bg-white/20 hover:bg-white/40'
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <td className="p-2 text-center">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => toggleAccountSelection(row.id)}
                                      className="border-[#008291]/50"
                                    />
                                  </td>
                                  {/* Account Name + Lag Heatmap Dot */}
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${severity.dot} ${severity.glow}`} />
                                      <AccIcon className="w-4 h-4 text-[#008291]" />
                                      <span className="text-slate-700">{row.accountName}</span>
                                    </div>
                                  </td>
                                  {/* Type */}
                                  <td className="p-3 text-center">
                                    <Badge className="text-[10px] rounded-full bg-white/50 text-slate-600 border border-white/30">
                                      {accountTypeLabels[row.accountType] || row.accountType}
                                    </Badge>
                                  </td>
                                  {/* Frequency */}
                                  <td className="p-3 text-center">
                                    <Badge className="text-[10px] rounded-full bg-white/50 text-slate-600 border border-white/30">
                                      {frequencyLabels[row.frequency] || 'חודשי'}
                                    </Badge>
                                  </td>
                                  {/* Last Reconciliation */}
                                  <td className="p-3 text-center text-xs text-slate-600">
                                    {formatDate(row.lastDate)}
                                  </td>
                                  {/* Next Reconciliation */}
                                  <td className="p-3 text-center text-xs text-slate-600">
                                    {formatDate(row.nextDate)}
                                  </td>
                                  {/* Days Overdue */}
                                  <td className="p-3 text-center">
                                    {row.daysOverdue > 0 ? (
                                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                        row.daysOverdue > 30
                                          ? 'bg-rose-100/60 text-rose-700'
                                          : 'bg-amber-100/60 text-amber-700'
                                      }`}>
                                        {row.daysOverdue} ימים
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-400">-</span>
                                    )}
                                  </td>
                                  {/* Status — Interactive Glass Button */}
                                  <td className="p-3 text-center">
                                    <button
                                      className={`inline-flex items-center gap-1.5 text-[10px] rounded-full px-3 py-1.5 font-medium backdrop-blur-sm border shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${stsCfg.pill}`}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const statusCycle = ['not_started', 'in_progress', 'completed'];
                                        const currentIdx = statusCycle.indexOf(row.latestStatus);
                                        const nextStatus = statusCycle[(currentIdx + 1) % statusCycle.length];
                                        try {
                                          if (row.latestRec?.id) {
                                            await AccountReconciliation.update(row.latestRec.id, { status: nextStatus });
                                          } else {
                                            await AccountReconciliation.create({
                                              client_id: row.clientId,
                                              client_account_id: row.id,
                                              client_name: row.clientName,
                                              account_name: row.accountName,
                                              status: nextStatus,
                                              period: new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
                                            });
                                          }
                                          const nextStsCfg = statusConfig[nextStatus] || statusConfig.not_started;
                                          toast.success(`${row.accountName}: ${nextStsCfg.label}`);
                                          loadData();
                                        } catch (err) {
                                          toast.error('שגיאה בעדכון סטטוס');
                                        }
                                      }}
                                    >
                                      {stsCfg.icon && <stsCfg.icon className="w-3 h-3" />}
                                      {stsCfg.label}
                                    </button>
                                  </td>
                                  {/* Quick Sync Action — ⚡ Zap: Mark as Done + update last_sync */}
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Button
                                        size="sm"
                                        className="text-[10px] gap-1 rounded-full backdrop-blur-sm bg-white/40 hover:bg-[#008291] text-[#008291] hover:text-white border border-[#008291]/30 hover:border-transparent shadow-sm hover:shadow-lg transition-all"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const today = new Date().toISOString().split('T')[0];
                                            const newNext = calcNextDate(today, row.frequency);
                                            await handleUpdateAccount(row.id, {
                                              last_reconciliation_date: today,
                                              next_reconciliation_due: newNext,
                                              last_sync_date: new Date().toISOString(),
                                            });
                                            // Also mark reconciliation as completed
                                            if (row.latestRec?.id) {
                                              await AccountReconciliation.update(row.latestRec.id, { status: 'completed' });
                                            } else {
                                              await AccountReconciliation.create({
                                                client_id: row.clientId,
                                                client_account_id: row.id,
                                                client_name: row.clientName,
                                                account_name: row.accountName,
                                                status: 'completed',
                                                period: new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
                                              });
                                            }
                                            toast.success(`${row.accountName} — הושלם וסונכרן`);
                                            loadData();
                                          } catch (err) {
                                            toast.error('שגיאה בסנכרון');
                                          }
                                        }}
                                      >
                                        <Zap className="w-3 h-3" />
                                        סנכרן
                                      </Button>
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Client Drawer ──────────────────────────────────────── */}
      <ClientDrawer
        client={drawerClient}
        tasks={allTasks}
        open={!!drawerClient}
        onClose={() => setDrawerClient(null)}
      />

      {/* ── Edit Dialog ────────────────────────────────────────── */}
      <ReconciliationEditDialog
        reconciliation={editingRec}
        clients={clients}
        open={showEditDialog}
        onClose={() => { setShowEditDialog(false); setEditingRec(null); }}
        onSave={handleSaveReconciliation}
      />

      {/* ── Bulk Action Dialog ─────────────────────────────────── */}
      <BulkActionDialog
        open={showBulkDialog}
        onClose={() => setShowBulkDialog(false)}
        selectedCount={selectedAccounts.size}
        onApply={handleBulkUpdate}
      />
    </div>
  );
}
