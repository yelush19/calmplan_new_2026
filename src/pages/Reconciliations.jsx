
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ArrowUpDown, Loader, ExternalLink, Zap, Filter, Users, RefreshCw,
  LayoutGrid, Table2, CalendarDays, Edit3, Pencil,
  TrendingUp, Activity, BarChart3, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

import { loadCompanyTree, isNodeEnabled, onTreeChange, invalidateTreeCache } from '@/services/processTreeService';

// ─── Status Configuration — Glassmorphism Pill Styles ──────────
const statusConfig = {
  not_started:            { label: 'לא התחיל',       pill: 'bg-white text-slate-700 border border-[#E0E0E0] ', icon: Clock },
  waiting_for_materials:  { label: 'ממתין לחומרים',   pill: 'bg-amber-100 text-amber-800 border border-amber-200',            icon: AlertCircle },
  in_progress:            { label: 'בתהליך',          pill: 'bg-[#4682B4]/10 text-[#4682B4] border border-[#4682B4]',         icon: Clock },
  completed:              { label: 'הושלם',           pill: 'bg-teal-100 text-teal-800 border border-teal-200',               icon: CheckCircle },
  issues:                 { label: 'בעיות',           pill: 'bg-amber-100 text-amber-800 border border-amber-200',               icon: AlertCircle },
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
  critical: { dot: 'bg-orange-600',  glow: 'shadow-[0_0_12px_rgba(234,88,12,0.6)] animate-pulse', text: 'text-orange-700' },
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

// ─── AYOA-Inspired View Tabs ────────────────────────────────────
const AYOA_VIEWS = [
  { key: 'table',    label: 'טבלה',        icon: Table2,       color: '#4682B4', bg: '#E0F7FA' },
  { key: 'status',   label: 'לפי סטטוס',   icon: LayoutGrid,   color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'timeline', label: 'ציר זמן',     icon: CalendarDays,  color: '#059669', bg: '#D1FAE5' },
];

// AYOA color palette — ADHD-friendly: high contrast, soft pastels, clear boundaries
const AYOA_STATUS_COLORS = {
  not_started:           { bg: 'bg-gradient-to-br from-slate-50 to-slate-100', border: 'border-slate-300', header: 'bg-slate-200 text-slate-700', accent: '#94A3B8' },
  waiting_for_materials: { bg: 'bg-gradient-to-br from-amber-50 to-yellow-50', border: 'border-amber-300', header: 'bg-amber-200 text-amber-800', accent: '#F59E0B' },
  in_progress:           { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',  border: 'border-blue-300',  header: 'bg-blue-200 text-blue-800',  accent: '#3B82F6' },
  completed:             { bg: 'bg-gradient-to-br from-emerald-50 to-teal-50', border: 'border-emerald-300', header: 'bg-emerald-200 text-emerald-800', accent: '#10B981' },
  issues:                { bg: 'bg-gradient-to-br from-orange-50 to-red-50',   border: 'border-orange-300', header: 'bg-orange-200 text-orange-800', accent: '#F97316' },
};

// ─── Inline Date Cell ───────────────────────────────────────────
function InlineDateCell({ value, onChange, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setTempVal(value || ''); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={tempVal}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (tempVal !== (value || '')) onChange(tempVal);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); if (tempVal !== (value || '')) onChange(tempVal); }
          if (e.key === 'Escape') { setEditing(false); setTempVal(value || ''); }
        }}
        className={`text-xs border border-[#4682B4] rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-[#4682B4]/30 outline-none w-[130px] ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`group inline-flex items-center gap-1 text-xs hover:bg-[#4682B4]/10 px-2 py-1 rounded-lg transition-colors cursor-pointer ${className}`}
      title="לחץ לעריכה"
    >
      <span>{value ? formatDate(value) : '-'}</span>
      <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Sortable Table Header ──────────────────────────────────────
function SortableHeader({ label, sortKey, currentSort, onSort }) {
  const isActive = currentSort.key === sortKey;
  const isAsc = currentSort.dir === 'asc';

  return (
    <th
      className="p-3 font-bold text-white cursor-pointer select-none hover:brightness-110 transition-all text-[12px]"
      style={{ background: 'linear-gradient(135deg, #4682B4, #5A9CC5)' }}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span>{label}</span>
        {isActive ? (
          isAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
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
      <SheetContent side="right" className="w-[400px] bg-white border-l border-[#E0E0E0] rounded-l-[32px]">
        <SheetHeader className="text-end">
          <SheetTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#4682B4]" />
            {client.nickname || client.name}
          </SheetTitle>
          <SheetDescription className="text-end text-sm text-slate-500">
            {clientTasks.length} משימות פעילות
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {clientTasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">אין משימות פעילות ללקוח זה</p>
          ) : (
            clientTasks.map(task => (
              <div key={task.id} className="p-3 bg-white  rounded-[16px] shadow-sm border border-[#E0E0E0]">
                <p className="font-medium text-sm text-slate-800">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-[12px] rounded-full px-2 ${statusConfig[task.status]?.pill || statusConfig.not_started.pill}`}>
                    {statusConfig[task.status]?.label || task.status}
                  </Badge>
                  {task.due_date && (
                    <span className="text-[12px] text-slate-400 flex items-center gap-0.5">
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
      <DialogContent className="bg-white border-[#E0E0E0] rounded-[24px] max-w-md">
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
              className="rounded-[16px] bg-white border-[#E0E0E0]  mt-1"
            />
          </div>
          <div>
            <Label>סטטוס חדש</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="rounded-[16px] bg-white border-[#E0E0E0]  mt-1">
                <SelectValue placeholder="ללא שינוי" />
              </SelectTrigger>
              <SelectContent className="bg-white  border-[#E0E0E0] rounded-[16px]">
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
            className="bg-[#4682B4] hover:bg-[#2C3E50] text-white rounded-[12px]"
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
      <DialogContent className="bg-white border-[#E0E0E0] rounded-[24px] max-w-lg">
        <DialogHeader>
          <DialogTitle>{reconciliation?.id ? 'עריכת התאמה' : 'הוספת התאמה חדשה'}</DialogTitle>
          <DialogDescription>פרטי התאמת חשבון</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>לקוח</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v, client_account_id: '' }))}>
                <SelectTrigger className="rounded-[12px] bg-white border-[#E0E0E0]"><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent className="bg-white  border-[#E0E0E0] rounded-[12px]">{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>חשבון</Label>
              <Select value={formData.client_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_account_id: v }))} disabled={clientAccounts.length === 0}>
                <SelectTrigger className="rounded-[12px] bg-white border-[#E0E0E0]"><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
                <SelectContent className="bg-white  border-[#E0E0E0] rounded-[12px]">{clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>תקופה</Label>
              <Input value={formData.period} onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))} placeholder="ינואר 2026" className="rounded-[12px] bg-white border-[#E0E0E0]" />
            </div>
            <div>
              <Label>סוג</Label>
              <Select value={formData.reconciliation_type} onValueChange={(v) => setFormData(prev => ({ ...prev, reconciliation_type: v }))}>
                <SelectTrigger className="rounded-[12px] bg-white border-[#E0E0E0]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white  border-[#E0E0E0] rounded-[12px]">
                  <SelectItem value="bank_credit">בנק/אשראי</SelectItem>
                  <SelectItem value="internal">פנימי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סטטוס</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="rounded-[12px] bg-white border-[#E0E0E0]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white  border-[#E0E0E0] rounded-[12px]">
                  {Object.entries(statusConfig).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תאריך יעד</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))} className="rounded-[12px] bg-white border-[#E0E0E0]" />
            </div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="הערות..." className="min-h-[60px] rounded-[12px] bg-white border-[#E0E0E0]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-[12px]">ביטול</Button>
          <Button onClick={handleSubmit} className="bg-[#4682B4] hover:bg-[#2C3E50] text-white rounded-[12px]">שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Group Accordion Header — AYOA Organic Style ─────────
function ClientGroupHeader({
  clientName, client, accounts, isExpanded, onToggle,
  isSelected, onSelectClient, onOpenDrawer,
}) {
  const totalAccounts = accounts.length;
  const laggingCount = accounts.filter(r => r.daysOverdue > 0).length;
  const completedCount = accounts.filter(r => r.latestStatus === 'completed').length;
  const worstLag = Math.max(0, ...accounts.map(r => r.daysOverdue));
  const worstSeverity = getLagSeverity(worstLag);
  const completionPct = totalAccounts > 0 ? Math.round((completedCount / totalAccounts) * 100) : 0;

  const severityAccent = worstSeverity === 'critical' || worstSeverity === 'high'
    ? '#EA580C' : worstSeverity === 'medium' ? '#F59E0B' : '#10B981';

  return (
    <div
      className={`p-3.5 cursor-pointer transition-all rounded-[20px] ${
        isExpanded
          ? 'bg-gradient-to-l from-white to-slate-50 border border-[#E0E0E0] shadow-sm'
          : 'hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-center gap-3 flex-1" onClick={onToggle}>
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectClient(clientName)}
            className="border-[#4682B4]/50"
          />
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-[#4682B4]" />
        </motion.div>

        {/* Client name + severity dot */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: severityAccent, boxShadow: laggingCount > 0 ? `0 0 8px ${severityAccent}60` : 'none' }} />
          <button
            className="font-bold text-slate-800 text-sm hover:text-[#4682B4] transition-colors text-end"
            onClick={(e) => { e.stopPropagation(); onOpenDrawer(client); }}
          >
            {clientName}
          </button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mr-auto">
          <Badge className="text-[11px] rounded-full bg-[#4682B4]/10 text-[#4682B4] border border-[#4682B4]/20 px-2 py-0.5">
            {totalAccounts} חשבונות
          </Badge>
          {laggingCount > 0 && (
            <Badge className={`text-[11px] rounded-full px-2 py-0.5 ${
              worstSeverity === 'critical' || worstSeverity === 'high'
                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}>
              {laggingCount} בפיגור
            </Badge>
          )}
          {completedCount === totalAccounts && totalAccounts > 0 && (
            <Badge className="text-[11px] rounded-full bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> הכל מעודכן
            </Badge>
          )}
        </div>

        {/* Mini progress bar */}
        <div className="hidden md:flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: completionPct === 100 ? '#10B981' : '#4682B4' }}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: completionPct === 100 ? '#10B981' : '#4682B4' }}>
            {completionPct}%
          </span>
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

  // AYOA view mode
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => { loadData(); }, []);

  // Bi-directional sync listener
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.source === 'reconciliations') return; // skip own events
      console.log('[Reconciliations] 📡 Data synced from:', e.detail?.source);
      loadData();
    };
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  // Listen for tree changes → reload (e.g., reconciliation node disabled in Architect)
  useEffect(() => {
    const unsub = onTreeChange(() => {
      console.log('[Reconciliations] 📡 Tree changed — reloading...');
      loadData();
    });
    return unsub;
  }, []);

  // Listen for data-synced events (e.g., account updated in ClientAccountsManager)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.source === 'Reconciliations') return; // skip own events
      console.log('[Reconciliations] 📡 Data synced — reloading...');
      loadData();
    };
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load tree to check which clients have P2_reconciliation enabled
      invalidateTreeCache();
      const [recsData, clientsData, accountsData, tasksData, treeResult] = await Promise.all([
        AccountReconciliation.list(null, 500).catch(() => []),
        Client.list(null, 500).catch(() => []),
        ClientAccount.list(null, 2000).catch(() => []),
        Task.list(null, 5000).catch(() => []),
        loadCompanyTree().catch(() => ({ tree: null })),
      ]);

      // Filter active clients — only include those with P2_reconciliation enabled (if tree exists)
      const activeClients = (clientsData || []).filter(c => {
        if (c.status !== 'active') return false;
        // If company tree is loaded, respect the client's tree config
        if (treeResult?.tree && c.process_tree) {
          return isNodeEnabled(c.process_tree, 'P2_reconciliation');
        }
        return true; // fallback: show all active if tree unavailable
      });

      setReconciliations(recsData || []);
      setClients(activeClients);
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
      // If last_reconciliation_date changed, also update matching reconciliation tasks
      if (updates.last_reconciliation_date) {
        const row = rows.find(r => r.id === accountId);
        if (row) {
          // Find reconciliation tasks for this client and mark completed
          const matchingTasks = allTasks.filter(t =>
            t.client_name === row.clientName &&
            (t.category === 'התאמות חשבונות' || t.category === 'התאמות') &&
            t.status !== 'completed' && t.status !== 'not_relevant'
          );
          for (const task of matchingTasks) {
            await Task.update(task.id, { status: 'completed' });
          }
        }
      }
      // Dispatch bi-directional sync event
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { source: 'reconciliations', accountId, updates }
      }));
      await loadData();
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { type: 'client_account', source: 'Reconciliations', timestamp: new Date().toISOString() }
      }));
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
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { type: 'client_account', source: 'Reconciliations', timestamp: new Date().toISOString() }
      }));
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
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { type: 'reconciliation', source: 'Reconciliations', timestamp: new Date().toISOString() }
      }));
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

  // ── Contextual filter: reconciliation tasks for AYOA map views ──
  // Uses allTasks for AYOA views. Falls back to full array if no matches.
  const RECONCILIATION_CATEGORIES = ['התאמות', 'work_reconciliation', 'הנהלת חשבונות', 'work_bookkeeping'];
  const reconciliationTasks = useMemo(() => {
    const filtered = (allTasks || []).filter(t =>
      RECONCILIATION_CATEGORIES.includes(t.category)
    );
    return filtered.length > 0 ? filtered : (allTasks || []);
  }, [allTasks]);

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

  // ── Derived stats for pipeline ────────────────────────────────
  const inProgressCount = rows.filter(r => r.latestStatus === 'in_progress').length;
  const notStartedCount = rows.filter(r => r.latestStatus === 'not_started' || r.latestStatus === 'waiting_for_materials').length;
  const completionPct = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  // Severity distribution for heatmap
  const severityCounts = useMemo(() => ({
    ok: rows.filter(r => r.lagSeverity === 'ok').length,
    low: rows.filter(r => r.lagSeverity === 'low').length,
    medium: rows.filter(r => r.lagSeverity === 'medium').length,
    high: rows.filter(r => r.lagSeverity === 'high').length,
    critical: rows.filter(r => r.lagSeverity === 'critical').length,
  }), [rows]);

  return (
    <div className="relative z-[1] space-y-5 p-4 md:p-6 bg-white border border-[#E0E0E0] shadow-xl rounded-[32px]" dir="rtl">
      {/* ── Header — AYOA Gradient Style ──────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3.5 rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg, #E8F4FD 0%, #D1ECFD 100%)', boxShadow: '0 4px 12px rgba(70,130,180,0.15)' }}>
            <BookCheck className="w-7 h-7" style={{ color: '#4682B4' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">התאמות חשבונות</h1>
            <p className="text-slate-400 text-xs">P2 · מעקב ובקרה · {totalClients} לקוחות · {rows.length} חשבונות</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedAccounts.size > 0 && (
            <Button
              className="bg-[#4682B4] hover:bg-[#3A6F9A] text-white rounded-xl gap-1.5 text-xs shadow-sm"
              onClick={() => setShowBulkDialog(true)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              עדכון גורף ({selectedAccounts.size})
            </Button>
          )}
          <Button
            className="bg-[#4682B4] hover:bg-[#2C3E50] text-white rounded-xl text-xs shadow-sm"
            onClick={() => { setEditingRec(null); setShowEditDialog(true); }}
          >
            <Plus className="w-3.5 h-3.5 ms-1.5" />
            הוסף התאמה
          </Button>
        </div>
      </div>

      {/* ── Production Flow Pipeline — Organic Capsules ────────── */}
      <div className="rounded-[20px] p-4" style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, #F5F7FA 100%)' }}>
        <div className="flex items-center justify-between gap-3 overflow-x-auto">
          {[
            { label: 'לא התחיל', count: notStartedCount, icon: Clock, color: '#94A3B8', bg: '#F1F5F9' },
            { label: 'בתהליך', count: inProgressCount, icon: Activity, color: '#4682B4', bg: '#E8F4FD' },
            { label: 'בפיגור', count: overdueCount, icon: AlertTriangle, color: '#F59E0B', bg: '#FEF3C7' },
            { label: 'הושלם', count: completedCount, icon: CheckCircle, color: '#10B981', bg: '#D1FAE5' },
          ].map((phase, i, arr) => (
            <React.Fragment key={phase.label}>
              <motion.div
                className="flex-1 min-w-[130px] p-3.5 rounded-[16px] border transition-all hover:shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${phase.bg} 0%, white 100%)`,
                  borderColor: phase.color + '30',
                  boxShadow: phase.count > 0 ? `0 2px 8px ${phase.color}15` : 'none',
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: phase.color + '15' }}>
                    <phase.icon className="w-3.5 h-3.5" style={{ color: phase.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{phase.label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: phase.color }}>{phase.count}</div>
                {rows.length > 0 && (
                  <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((phase.count / rows.length) * 100)}%`, backgroundColor: phase.color }} />
                  </div>
                )}
              </motion.div>
              {i < arr.length - 1 && (
                <div className="hidden md:flex items-center text-slate-300 shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Overall completion bar */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-500">התקדמות כוללת</span>
          <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden border border-slate-100">
            <motion.div
              className="h-full rounded-full"
              style={{ background: completionPct === 100 ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #4682B4, #5A9CC5)' }}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: completionPct === 100 ? '#10B981' : '#4682B4' }}>{completionPct}%</span>
        </div>
      </div>

      {/* ── KPI Cards — AYOA Organic Capsules ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Clients */}
        <div className="p-4 rounded-[20px] border border-[#4682B4]/15 shadow-sm" style={{ background: 'linear-gradient(135deg, #F0F7FD 0%, white 100%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4682B420' }}>
              <Users className="w-4 h-4" style={{ color: '#4682B4' }} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">לקוחות</span>
          </div>
          <div className="text-2xl font-bold text-[#4682B4]">{totalClients}</div>
        </div>
        {/* Accounts */}
        <div className="p-4 rounded-[20px] border border-[#0891B2]/15 shadow-sm" style={{ background: 'linear-gradient(135deg, #ECFEFF 0%, white 100%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0891B220' }}>
              <BarChart3 className="w-4 h-4" style={{ color: '#0891B2' }} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">חשבונות</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#0891B2' }}>{rows.length}</div>
        </div>
        {/* Completion Rate */}
        <div className="p-4 rounded-[20px] border border-teal-100 shadow-sm" style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, white 100%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-teal-50">
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">שיעור השלמה</span>
          </div>
          <div className="text-2xl font-bold text-teal-600">{completionPct}%</div>
        </div>
        {/* Lag Heatmap DNA */}
        <div className="p-4 rounded-[20px] border border-slate-100 shadow-sm" style={{ background: 'linear-gradient(135deg, #FEFCE8 0%, white 100%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">מפת חום פיגור</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {[
              { key: 'ok', color: '#2DD4BF', label: 'תקין' },
              { key: 'low', color: '#38BDF8', label: 'קל' },
              { key: 'medium', color: '#FBBF24', label: 'בינוני' },
              { key: 'high', color: '#F97316', label: 'גבוה' },
              { key: 'critical', color: '#EA580C', label: 'קריטי' },
            ].map(s => (
              <div key={s.key} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: s.color, boxShadow: severityCounts[s.key] > 0 ? `0 0 6px ${s.color}50` : 'none' }}
                >
                  {severityCounts[s.key]}
                </div>
                <span className="text-[8px] text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Overdue Alert ───────────────────────────────────────── */}
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[16px] p-3 flex items-center gap-2 border"
          style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}
        >
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-600" />
          <span className="font-semibold text-sm text-amber-800">{overdueCount} חשבונות בפיגור התאמה</span>
          <span className="text-[11px] text-amber-600 mr-auto">{rows.filter(r => r.daysOverdue > 30).length} מעל 30 יום</span>
        </motion.div>
      )}

      {/* ── AYOA View Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white border border-[#E0E0E0] rounded-[20px] p-1.5 shadow-sm w-fit">
        {AYOA_VIEWS.map(v => {
          const Icon = v.icon;
          const isActive = viewMode === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
              style={isActive ? { backgroundColor: v.color } : {}}
            >
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter & Search — Organic Glass ─────────────────────── */}
      <div className="rounded-[20px] p-4 border border-slate-100 shadow-sm" style={{ background: 'linear-gradient(135deg, #FAFBFC 0%, white 100%)' }}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Lag Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[#4682B4]" />
            <span className="text-[11px] font-semibold text-slate-500 ms-1">סינון פיגור:</span>
            {LAG_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setLagFilter(opt.key); setCustomLagDays(''); }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  lagFilter === opt.key
                    ? 'bg-[#4682B4] text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-[#4682B4]/40 hover:shadow-sm'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLagFilter('custom')}
                className={`px-3 py-1.5 rounded-r-xl text-[11px] font-semibold transition-all ${
                  lagFilter === 'custom'
                    ? 'bg-[#4682B4] text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-[#4682B4]/40'
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
                  className="w-20 h-8 text-xs rounded-l-xl rounded-r-none bg-white border-slate-200"
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
              className="pe-10 rounded-xl bg-white border-slate-200 text-sm"
            />
          </div>
        </div>
      </div>


      {/* ── TABLE VIEW ─────────────────────────────────────────── */}
      {viewMode === 'table' && (
      <>
      {/* ── Expand/Collapse + Select All ─────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={selectedAccounts.size === rows.length && rows.length > 0}
            onCheckedChange={toggleSelectAll}
            className="border-[#4682B4]/50"
          />
          <span className="text-[11px] font-medium text-slate-500">
            {selectedAccounts.size > 0
              ? `${selectedAccounts.size} נבחרו`
              : 'בחר הכל'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={expandAll} className="text-[11px] font-semibold text-[#4682B4] hover:underline">פרוס הכל</button>
          <span className="text-slate-200">|</span>
          <button onClick={collapseAll} className="text-[11px] font-semibold text-[#4682B4] hover:underline">כווץ הכל</button>
        </div>
      </div>

      {/* ── Client-Grouped Accordion Table ───────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#4682B4]" />
          <span className="text-sm font-bold text-slate-600">טוען נתונים...</span>
        </div>
      ) : clientGroups.length === 0 ? (
        <div className="text-center py-20 rounded-[24px] border border-dashed border-slate-200" style={{ background: 'linear-gradient(135deg, #FAFBFC, #F5F7FA)' }}>
          <BookCheck className="w-14 h-14 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm font-semibold">אין חשבונות להצגה</p>
          <p className="text-slate-300 text-xs mt-1">נסה לשנות את הסינון או להוסיף התאמות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientGroups.map(([clientName, { client, rows: clientRows }]) => {
            const isExpanded = expandedClients.has(clientName);

            return (
              <motion.div
                key={clientName}
                layout
                className="bg-white border border-slate-100 rounded-[20px] shadow-sm overflow-hidden hover:shadow-md transition-shadow"
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
                              <th className="p-2 w-10 rounded-tr-xl" style={{ background: 'linear-gradient(135deg, #4682B4, #5A9CC5)' }}></th>
                              <SortableHeader label="חשבון" sortKey="accountName" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="סוג" sortKey="accountType" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="תדירות" sortKey="frequency" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="התאמה אחרונה" sortKey="lastDate" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="התאמה הבאה" sortKey="nextDate" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="פיגור (ימים)" sortKey="daysOverdue" currentSort={sort} onSort={handleSort} />
                              <SortableHeader label="סטטוס" sortKey="latestStatus" currentSort={sort} onSort={handleSort} />
                              <th className="p-3 font-bold text-white text-center rounded-tl-xl" style={{ background: 'linear-gradient(135deg, #4682B4, #5A9CC5)' }}>פעולה</th>
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
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.02 }}
                                  className={`border-b border-slate-100 transition-all ${
                                    isChecked
                                      ? 'bg-[#4682B4]/5'
                                      : row.daysOverdue > 30
                                        ? 'bg-gradient-to-l from-orange-50/80 to-white hover:from-orange-50'
                                        : row.daysOverdue > 0
                                          ? 'bg-gradient-to-l from-amber-50/60 to-white hover:from-amber-50/80'
                                          : 'bg-white hover:bg-slate-50/80'
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <td className="p-2 text-center">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => toggleAccountSelection(row.id)}
                                      className="border-[#4682B4]/50"
                                    />
                                  </td>
                                  {/* Account Name + Lag Heatmap Dot */}
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${severity.dot} ${severity.glow}`} />
                                      <AccIcon className="w-4 h-4 text-[#4682B4]" />
                                      <span className="text-slate-700">{row.accountName}</span>
                                    </div>
                                  </td>
                                  {/* Type */}
                                  <td className="p-3 text-center">
                                    <Badge className="text-[12px] rounded-full bg-white text-slate-600 border border-[#E0E0E0]">
                                      {accountTypeLabels[row.accountType] || row.accountType}
                                    </Badge>
                                  </td>
                                  {/* Frequency */}
                                  <td className="p-3 text-center">
                                    <Badge className="text-[12px] rounded-full bg-white text-slate-600 border border-[#E0E0E0]">
                                      {frequencyLabels[row.frequency] || 'חודשי'}
                                    </Badge>
                                  </td>
                                  {/* Last Reconciliation — Inline Editable */}
                                  <td className="p-3 text-center">
                                    <InlineDateCell
                                      value={row.lastDate}
                                      onChange={async (newDate) => {
                                        try {
                                          const newNext = calcNextDate(newDate, row.frequency);
                                          await handleUpdateAccount(row.id, {
                                            last_reconciliation_date: newDate,
                                            next_reconciliation_due: newNext,
                                          });
                                          toast.success(`${row.accountName} — תאריך התאמה עודכן`);
                                        } catch (err) {
                                          toast.error('שגיאה בעדכון תאריך');
                                        }
                                      }}
                                    />
                                  </td>
                                  {/* Next Reconciliation — Inline Editable (manual override) */}
                                  <td className="p-3 text-center">
                                    <InlineDateCell
                                      value={row.nextDate}
                                      onChange={async (newDate) => {
                                        try {
                                          await handleUpdateAccount(row.id, {
                                            next_reconciliation_due: newDate,
                                          });
                                          toast.success(`${row.accountName} — יעד עודכן ידנית`);
                                        } catch (err) {
                                          toast.error('שגיאה בעדכון יעד');
                                        }
                                      }}
                                    />
                                  </td>
                                  {/* Days Overdue */}
                                  <td className="p-3 text-center">
                                    {row.daysOverdue > 0 ? (
                                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                        row.daysOverdue > 30
                                          ? 'bg-orange-100 text-orange-700'
                                          : 'bg-amber-100 text-amber-700'
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
                                      className={`inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 font-medium  border shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${stsCfg.pill}`}
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
                                          window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
                                            detail: { source: 'reconciliations', type: 'status-change' }
                                          }));
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
                                        className="text-[11px] gap-1 rounded-xl bg-white hover:bg-[#4682B4] text-[#4682B4] hover:text-white border border-[#4682B4]/25 hover:border-transparent shadow-sm hover:shadow-md transition-all"
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
                                            window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
                                              detail: { source: 'reconciliations', type: 'quick-sync' }
                                            }));
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


      </>
      )}

      {/* ── STATUS BOARD VIEW (AYOA Kanban) ────────────────────── */}
      {viewMode === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(statusConfig).map(([statusKey, stsCfg]) => {
            const ayoaColors = AYOA_STATUS_COLORS[statusKey] || AYOA_STATUS_COLORS.not_started;
            const statusRows = sortedRows.filter(r => r.latestStatus === statusKey);
            return (
              <div key={statusKey} className={`rounded-[20px] border-2 ${ayoaColors.border} ${ayoaColors.bg} overflow-hidden min-h-[200px]`}>
                {/* Column Header */}
                <div className={`${ayoaColors.header} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    {stsCfg.icon && <stsCfg.icon className="w-4 h-4" />}
                    <span className="font-bold text-sm">{stsCfg.label}</span>
                  </div>
                  <Badge className="bg-white/60 text-inherit border-0 text-xs">{statusRows.length}</Badge>
                </div>
                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                  {statusRows.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">אין חשבונות</p>
                  ) : (
                    statusRows.map(row => {
                      const severity = lagSeverityConfig[row.lagSeverity];
                      return (
                        <motion.div
                          key={row.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-[14px] p-3 shadow-sm border border-white/50 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${severity.dot} ${severity.glow}`} />
                            <span className="font-bold text-xs text-slate-800 truncate">{row.clientName}</span>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{row.accountName}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">{formatDate(row.lastDate)}</span>
                            {row.daysOverdue > 0 && (
                              <Badge className={`text-[10px] rounded-full px-1.5 ${
                                row.daysOverdue > 30
                                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                                  : 'bg-amber-100 text-amber-700 border-amber-200'
                              }`}>
                                {row.daysOverdue}d
                              </Badge>
                            )}
                          </div>
                          {/* Quick sync button */}
                          <Button
                            size="sm"
                            className="w-full mt-2 text-[11px] h-7 gap-1 rounded-[10px] bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-none"
                            onClick={async () => {
                              try {
                                const today = new Date().toISOString().split('T')[0];
                                const newNext = calcNextDate(today, row.frequency);
                                await handleUpdateAccount(row.id, {
                                  last_reconciliation_date: today,
                                  next_reconciliation_due: newNext,
                                });
                                if (row.latestRec?.id) {
                                  await AccountReconciliation.update(row.latestRec.id, { status: 'completed' });
                                }
                                toast.success(`${row.accountName} — הושלם`);
                                loadData();
                              } catch (err) { toast.error('שגיאה'); }
                            }}
                          >
                            <Zap className="w-3 h-3" />
                            סנכרן עכשיו
                          </Button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TIMELINE VIEW (AYOA) ───────────────────────────────── */}
      {viewMode === 'timeline' && (
        <div className="bg-white border border-[#E0E0E0] rounded-[24px] p-6 shadow-sm">
          <div className="space-y-1">
            {/* Timeline header */}
            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-600 w-40">לקוח / חשבון</span>
              <span className="text-sm font-bold text-slate-600 w-28 text-center">התאמה אחרונה</span>
              <span className="text-sm font-bold text-slate-600 flex-1 text-center">ציר זמן</span>
              <span className="text-sm font-bold text-slate-600 w-28 text-center">יעד הבא</span>
              <span className="text-sm font-bold text-slate-600 w-20 text-center">פיגור</span>
            </div>
            {sortedRows.map((row, idx) => {
              const severity = lagSeverityConfig[row.lagSeverity];
              const maxDays = 90;
              const progressPct = row.lastDate && row.nextDate
                ? Math.min(100, Math.max(0, (
                    (Date.now() - new Date(row.lastDate).getTime()) /
                    (new Date(row.nextDate).getTime() - new Date(row.lastDate).getTime())
                  ) * 100))
                : 0;
              const barColor = progressPct > 100 ? '#F97316'
                : progressPct > 80 ? '#F59E0B'
                : progressPct > 50 ? '#3B82F6'
                : '#10B981';

              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="flex items-center gap-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-2 transition-colors"
                >
                  {/* Client + Account */}
                  <div className="w-40 truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{row.clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{row.accountName}</p>
                  </div>
                  {/* Last date */}
                  <div className="w-28 text-center text-xs text-slate-600">{formatDate(row.lastDate)}</div>
                  {/* Progress bar */}
                  <div className="flex-1">
                    <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progressPct, 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute inset-y-0 right-0 rounded-full"
                        style={{ backgroundColor: barColor, opacity: 0.7 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-600">{Math.round(progressPct)}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Next date */}
                  <div className="w-28 text-center text-xs text-slate-600">{formatDate(row.nextDate)}</div>
                  {/* Overdue */}
                  <div className="w-20 text-center">
                    {row.daysOverdue > 0 ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.daysOverdue > 30 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.daysOverdue}d
                      </span>
                    ) : (
                      <span className="text-xs text-teal-500">✓</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Client Drawer ──────────────────────────────────────── */}
      <ClientDrawer
        client={drawerClient}
        tasks={reconciliationTasks}
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
