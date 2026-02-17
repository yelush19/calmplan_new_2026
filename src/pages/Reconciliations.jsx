
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountReconciliation, Client, ClientAccount } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  BookCheck, Plus, Filter, Banknote, MoreHorizontal, CheckCircle,
  Clock, AlertCircle, Landmark, CreditCard, AlertTriangle,
  Calendar, ArrowLeft, Pencil, Search, BookUser, Building2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  not_started: { label: 'לא התחיל', color: 'bg-gray-200 text-gray-800', icon: Clock },
  waiting_for_materials: { label: 'ממתין לחומרים', color: 'bg-yellow-200 text-yellow-800', icon: AlertCircle },
  in_progress: { label: 'בתהליך', color: 'bg-blue-200 text-blue-800', icon: Clock },
  completed: { label: 'הושלם', color: 'bg-green-200 text-green-800', icon: CheckCircle },
  issues: { label: 'בעיות', color: 'bg-red-200 text-red-800', icon: AlertCircle },
};

const frequencyLabels = {
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי',
  yearly: 'שנתי',
};

const frequencyMonths = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semi_annual: 6,
  yearly: 12,
};

const loadingSystemLabels = {
  bizibox: 'BIZIBOX',
  summit: 'SUMMIT',
  manual: 'ידני',
  other: 'אחר',
};

const accountTypeIcons = {
  bank: Landmark,
  credit_card: CreditCard,
  bookkeeping: BookUser,
  clearing: Building2,
};

const accountTypeLabels = {
  bank: 'בנק',
  credit_card: 'אשראי',
  bookkeeping: 'הנה"ח',
  clearing: 'סליקה',
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

// --- Status Table Tab ---
function StatusTable({ accounts, clients, reconciliations, onUpdateAccount, searchTerm, statusFilter }) {
  const clientMap = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  // Build rows: each account as a row, enriched with client info and latest reconciliation
  const rows = useMemo(() => {
    return accounts
      .filter(acc => {
        const client = clientMap[acc.client_id];
        if (!client) return false;
        if (acc.account_status === 'inactive') return false;
        if (searchTerm && !client.name?.includes(searchTerm) && !acc.account_name?.includes(searchTerm)) return false;
        return true;
      })
      .map(acc => {
        const client = clientMap[acc.client_id];
        const nextDate = acc.next_reconciliation_due || calcNextDate(acc.last_reconciliation_date, acc.reconciliation_frequency);
        const daysOverdue = getDaysOverdue(nextDate);
        // Find latest reconciliation for this account
        const accountRecs = reconciliations
          .filter(r => r.client_account_id === acc.id)
          .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
        const latestRec = accountRecs[0];
        const latestStatus = latestRec?.status || 'not_started';

        return {
          account: acc,
          client,
          nextDate,
          daysOverdue,
          latestRec,
          latestStatus,
        };
      })
      .filter(row => {
        if (statusFilter === 'overdue') return row.daysOverdue > 0;
        if (statusFilter === 'all') return true;
        return row.latestStatus === statusFilter;
      })
      .sort((a, b) => {
        // Overdue first, then by next date
        if (a.daysOverdue > 0 && b.daysOverdue === 0) return -1;
        if (b.daysOverdue > 0 && a.daysOverdue === 0) return 1;
        return (a.nextDate || '').localeCompare(b.nextDate || '');
      });
  }, [accounts, clientMap, reconciliations, searchTerm, statusFilter]);

  const overdueCount = rows.filter(r => r.daysOverdue > 0).length;

  return (
    <div>
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">{overdueCount} חשבונות בפיגור התאמה!</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="text-right p-3 font-bold">לקוח</th>
              <th className="text-right p-3 font-bold">חשבון</th>
              <th className="text-center p-3 font-bold">סוג</th>
              <th className="text-center p-3 font-bold">אופן טעינה</th>
              <th className="text-center p-3 font-bold">תדירות</th>
              <th className="text-center p-3 font-bold">התאמה אחרונה</th>
              <th className="text-center p-3 font-bold">התאמה הבאה</th>
              <th className="text-center p-3 font-bold">סטטוס</th>
              <th className="text-center p-3 font-bold">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">אין חשבונות להצגה</td></tr>
            ) : rows.map(({ account, client, nextDate, daysOverdue, latestRec, latestStatus }) => {
              const isOverdue = daysOverdue > 0;
              const AccIcon = accountTypeIcons[account.account_type] || Landmark;
              return (
                <tr key={account.id} className={`border-b hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                  <td className="p-3 font-medium">{client.name}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <AccIcon className="w-4 h-4 text-slate-500" />
                      {account.account_name || account.bank_name}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className="text-xs">{accountTypeLabels[account.account_type] || account.account_type}</Badge>
                  </td>
                  <td className="p-3 text-center text-xs">{loadingSystemLabels[account.loading_system] || account.loading_system || '-'}</td>
                  <td className="p-3 text-center">
                    <Badge variant="secondary" className="text-xs">{frequencyLabels[account.reconciliation_frequency] || 'חודשי'}</Badge>
                  </td>
                  <td className="p-3 text-center text-xs">{formatDate(account.last_reconciliation_date)}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs font-medium ${isOverdue ? 'text-red-700' : 'text-gray-600'}`}>
                      {formatDate(nextDate)}
                      {isOverdue && (
                        <span className="block text-red-600 font-bold">{daysOverdue} ימי פיגור</span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Badge className={`text-xs ${statusConfig[latestStatus]?.color || 'bg-gray-200'}`}>
                      {statusConfig[latestStatus]?.label || 'לא התחיל'}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        const newNext = calcNextDate(today, account.reconciliation_frequency);
                        onUpdateAccount(account.id, {
                          last_reconciliation_date: today,
                          next_reconciliation_due: newNext,
                        });
                      }}
                    >
                      <CheckCircle className="w-3 h-3" /> סמן כהושלם
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Tasks Kanban Tab ---
function TasksKanban({ reconciliations, onStatusChange, onEdit }) {
  const columns = [
    { key: 'not_started', label: 'לא התחיל', color: 'border-gray-300 bg-gray-50' },
    { key: 'waiting_for_materials', label: 'ממתין לחומרים', color: 'border-yellow-300 bg-yellow-50' },
    { key: 'in_progress', label: 'בתהליך', color: 'border-blue-300 bg-blue-50' },
    { key: 'completed', label: 'הושלם', color: 'border-green-300 bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => {
        const items = reconciliations.filter(r => r.status === col.key);
        return (
          <div key={col.key} className={`rounded-lg border-2 ${col.color} p-3 min-h-[200px]`}>
            <h3 className="font-bold text-sm mb-3 flex items-center justify-between">
              {col.label}
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </h3>
            <div className="space-y-2">
              <AnimatePresence>
                {items.map(rec => (
                  <motion.div
                    key={rec.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-lg border p-3 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{rec.client_name}</div>
                        <div className="text-xs text-gray-500">{rec.account_name} - {rec.period}</div>
                        {rec.due_date && (
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(rec.due_date)}
                          </div>
                        )}
                        {rec.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rec.notes}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-3 h-3" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-white">
                          {Object.entries(statusConfig).filter(([k]) => k !== rec.status).map(([key, cfg]) => (
                            <DropdownMenuItem key={key} onClick={() => onStatusChange(rec.id, key)}>
                              העבר ל"{cfg.label}"
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={() => onEdit(rec)}>
                            <Pencil className="w-3 h-3 ml-1" /> ערוך
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">אין משימות</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Edit Dialog ---
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
      <DialogContent className="bg-white max-w-lg">
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
          <Button onClick={handleSubmit}>שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---
export default function ReconciliationsPage() {
  const [reconciliations, setReconciliations] = useState([]);
  const [clients, setClients] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingRec, setEditingRec] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('status_table');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recsData, clientsData, accountsData] = await Promise.all([
        AccountReconciliation.list(null, 500).catch(() => []),
        Client.list(null, 500).catch(() => []),
        ClientAccount.list(null, 2000).catch(() => []),
      ]);
      setReconciliations(recsData || []);
      setClients((clientsData || []).filter(c => c.status === 'active'));
      setAllAccounts(accountsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await AccountReconciliation.update(id, { status });
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
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

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      await ClientAccount.update(accountId, updates);
      loadData();
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  // Stats
  const activeAccounts = allAccounts.filter(a => a.account_status !== 'inactive');
  const overdueAccounts = activeAccounts.filter(acc => {
    const nextDate = acc.next_reconciliation_due || calcNextDate(acc.last_reconciliation_date, acc.reconciliation_frequency);
    return getDaysOverdue(nextDate) > 0;
  });
  const completedRecs = reconciliations.filter(r => r.status === 'completed').length;
  const pendingRecs = reconciliations.filter(r => r.status !== 'completed').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 rounded-full">
            <BookCheck className="w-8 h-8 text-teal-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">התאמות חשבונות</h1>
            <p className="text-gray-600">מעקב ובקרה על כל ההתאמות</p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => { setEditingRec(null); setShowEditDialog(true); }}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף התאמה
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{activeAccounts.length}</div>
            <div className="text-xs text-gray-500">חשבונות פעילים</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${overdueAccounts.length > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${overdueAccounts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{overdueAccounts.length}</div>
            <div className="text-xs text-gray-500">בפיגור</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{pendingRecs}</div>
            <div className="text-xs text-gray-500">משימות פתוחות</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{completedRecs}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="status_table">טבלת מצב</TabsTrigger>
          <TabsTrigger value="tasks_kanban">משימות התאמה</TabsTrigger>
        </TabsList>

        <TabsContent value="status_table">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="חיפוש לקוח או חשבון..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="סנן סטטוס" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="overdue">בפיגור בלבד</SelectItem>
                    {Object.entries(statusConfig).map(([k, c]) => (
                      <SelectItem key={k} value={k}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
                </div>
              ) : (
                <StatusTable
                  accounts={allAccounts}
                  clients={clients}
                  reconciliations={reconciliations}
                  onUpdateAccount={handleUpdateAccount}
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks_kanban">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">משימות התאמה</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse grid grid-cols-4 gap-4">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded" />)}
                </div>
              ) : (
                <TasksKanban
                  reconciliations={reconciliations}
                  onStatusChange={handleStatusChange}
                  onEdit={(rec) => { setEditingRec(rec); setShowEditDialog(true); }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
