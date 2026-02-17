
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountReconciliation } from '@/api/entities';
import { Client } from '@/api/entities';
import { ClientAccount } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BookCheck,
  Plus,
  Filter,
  Banknote,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  Landmark,
  CreditCard,
  Users,
  Briefcase,
  RefreshCw // Added RefreshCw import
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateProcessTasks } from '@/api/functions'; // Added generateProcessTasks import

const statusConfig = {
  not_started: { label: 'לא התחיל', color: 'bg-gray-200 text-gray-800', icon: Clock },
  waiting_for_materials: { label: 'ממתין לחומרים', color: 'bg-yellow-200 text-yellow-800', icon: AlertCircle },
  in_progress: { label: 'בתהליך', color: 'bg-blue-200 text-blue-800', icon: Clock },
  completed: { label: 'הושלם', color: 'bg-green-200 text-green-800', icon: CheckCircle },
  issues: { label: 'בעיות', color: 'bg-red-200 text-red-800', icon: AlertCircle },
};

const ReconciliationForm = ({ reconciliation, clients, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    client_id: reconciliation?.client_id || '',
    client_account_id: reconciliation?.client_account_id || '',
    period: reconciliation?.period || '',
    reconciliation_type: reconciliation?.reconciliation_type || 'bank_credit',
    status: reconciliation?.status || 'not_started',
    due_date: reconciliation?.due_date || '',
    notes: reconciliation?.notes || '',
  });

  const [clientAccounts, setClientAccounts] = useState([]);

  useEffect(() => {
    if (formData.client_id) {
      loadClientAccounts(formData.client_id);
    } else {
      setClientAccounts([]); // Clear accounts if no client is selected
    }
  }, [formData.client_id]);

  const loadClientAccounts = async (clientId) => {
    try {
      const accounts = await ClientAccount.filter({ client_id: clientId });
      setClientAccounts(accounts || []);
      // If a reconciliation is being edited and its client_account_id is not among the new accounts
      // for the currently selected client, clear the selected account to prevent invalid state.
      if (reconciliation && reconciliation.client_id === clientId && accounts.length > 0 && !accounts.some(acc => acc.id === reconciliation.client_account_id)) {
        setFormData(prev => ({ ...prev, client_account_id: '' }));
      }
    } catch (error) {
      console.error("Error loading client accounts:", error);
      setClientAccounts([]);
    }
  };

  const handleClientChange = (clientId) => {
    setFormData(prev => ({ ...prev, client_id: clientId, client_account_id: '' }));
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedClient = clients.find(c => c.id === formData.client_id);
    const selectedAccount = clientAccounts.find(a => a.id === formData.client_account_id);
    onSave({
        ...reconciliation, // preserve existing ID if editing
        ...formData,
        client_name: selectedClient?.name,
        account_name: selectedAccount?.account_name || 'חשבון כללי' // Default name if no specific account selected
    });
  };

  // Determine if the form is for editing or adding
  const isEditing = !!reconciliation?.id;

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>{isEditing ? 'עריכת התאמה' : 'הוספת התאמה חדשה'}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="client_id">לקוח</Label>
              <Select value={formData.client_id} onValueChange={handleClientChange}>
                <SelectTrigger id="client_id"><SelectValue placeholder="בחר לקוח..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="client_account_id">חשבון</Label>
              <Select value={formData.client_account_id} onValueChange={(value) => handleSelectChange('client_account_id', value)} disabled={!formData.client_id || clientAccounts.length === 0}>
                <SelectTrigger id="client_account_id"><SelectValue placeholder="בחר חשבון..." /></SelectTrigger>
                <SelectContent>
                  {clientAccounts.length > 0 ? clientAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.account_name}</SelectItem>
                  )) : <SelectItem value={null} disabled>בחר לקוח תחילה או אין חשבונות</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period">תקופה</Label>
              <Input id="period" type="text" value={formData.period} onChange={handleInputChange} placeholder="לדוגמא: ינואר 2023" required />
            </div>

            <div>
              <Label htmlFor="reconciliation_type">סוג התאמה</Label>
              <Select value={formData.reconciliation_type} onValueChange={(value) => handleSelectChange('reconciliation_type', value)}>
                <SelectTrigger id="reconciliation_type"><SelectValue placeholder="בחר סוג..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_credit">בנק/אשראי</SelectItem>
                  <SelectItem value="internal">פנימי</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">סטטוס</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger id="status"><SelectValue placeholder="בחר סטטוס..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="due_date">תאריך יעד</Label>
              <Input id="due_date" type="date" value={formData.due_date} onChange={handleInputChange} />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" value={formData.notes} onChange={handleInputChange} placeholder="הוסף הערות נוספות..." className="min-h-[80px]" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>ביטול</Button>
            <Button type="submit">שמור התאמה</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const ReconciliationCard = ({ rec, onStatusChange, onEdit }) => {
    const StatusIcon = statusConfig[rec.status]?.icon;
    return (
        <motion.div
            layout
            key={rec.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
        >
            <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">{rec.client_name}</CardTitle>
                            <p className="text-sm text-gray-500">{rec.account_name} - {rec.period}</p>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4"/></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {Object.keys(statusConfig).map(status => (
                                    <DropdownMenuItem key={status} onClick={() => onStatusChange(rec.id, status)}>
                                        שנה סטטוס ל"{statusConfig[status].label}"
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem onClick={() => onEdit(rec)}>
                                    ערוך התאמה
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                     <div>
                        <Badge className={`${statusConfig[rec.status]?.color}`}>
                            {StatusIcon && <StatusIcon className="w-4 h-4 ml-2" />}
                            {statusConfig[rec.status]?.label}
                        </Badge>
                        {rec.notes && <p className="text-sm mt-3 text-gray-600 p-2 bg-gray-50 rounded-md">{rec.notes}</p>}
                     </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default function ReconciliationsPage() {
  const [reconciliations, setReconciliations] = useState([]);
  const [clients, setClients] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', client: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReconciliation, setEditingReconciliation] = useState(null);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);

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
      setClients(clientsData || []);
      setAllAccounts(accountsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  // Build a summary of accounts per client for the overview section
  const accountsSummary = useMemo(() => {
    const clientMap = {};
    clients.forEach(c => { clientMap[c.id] = c; });

    const summary = {};
    allAccounts.forEach(acc => {
      const client = clientMap[acc.client_id];
      if (!client) return;
      if (!summary[acc.client_id]) {
        summary[acc.client_id] = { client, accounts: [] };
      }
      summary[acc.client_id].accounts.push(acc);
    });
    return Object.values(summary).sort((a, b) =>
      (a.client.name || '').localeCompare(b.client.name || '', 'he')
    );
  }, [clients, allAccounts]);

  const handleStatusChange = async (id, status) => {
    try {
      await AccountReconciliation.update(id, { status });
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleSaveReconciliation = async (reconciliationData) => {
    try {
      if (reconciliationData.id) {
        await AccountReconciliation.update(reconciliationData.id, reconciliationData);
      } else {
        await AccountReconciliation.create(reconciliationData);
      }
      setIsFormOpen(false);
      setEditingReconciliation(null); // Clear editing state
      loadData();
    } catch (error) {
      console.error("Error saving reconciliation:", error);
    }
  };

  const handleGenerateReconciliationTasks = async () => {
    setIsGeneratingTasks(true);
    setGenerationResult(null); // Clear previous result
    
    try {
      const response = await generateProcessTasks({ taskType: 'reconciliations' });
      
      if (response.data.success) {
        setGenerationResult({
          type: 'success',
          message: response.data.message,
          details: response.data.results
        });
        // Refresh data after tasks are generated
        loadData();
      } else {
        setGenerationResult({
          type: 'error',
          message: response.data.message || 'שגיאה ביצירת משימות'
        });
      }
    } catch (error) {
      console.error("Error generating reconciliation tasks:", error);
      setGenerationResult({
        type: 'error',
        message: 'שגיאה בקריאה לפונקציה'
      });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const filteredRecs = useMemo(() => {
    return reconciliations.filter(r =>
      (filters.status === 'all' || r.status === filters.status) &&
      (filters.client === 'all' || r.client_id === filters.client)
    );
  }, [reconciliations, filters]);

  const bankCreditRecs = filteredRecs.filter(r => r.reconciliation_type === 'bank_credit');
  const internalRecs = {
    clients: filteredRecs.filter(r => r.reconciliation_type === 'internal' && r.internal_type === 'clients'),
    suppliers: filteredRecs.filter(r => r.reconciliation_type === 'internal' && r.internal_type === 'suppliers'),
    institutions: filteredRecs.filter(r => r.reconciliation_type === 'internal' && r.internal_type === 'institutions'),
    other: filteredRecs.filter(r => r.reconciliation_type === 'internal' && r.internal_type === 'other'),
  };

  const progress = reconciliations.length > 0 ?
    (reconciliations.filter(r => r.status === 'completed').length / reconciliations.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isFormOpen && (
          <ReconciliationForm
            reconciliation={editingReconciliation}
            clients={clients}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingReconciliation(null);
            }}
            onSave={handleSaveReconciliation}
          />
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 rounded-full">
                <BookCheck className="w-8 h-8 text-teal-700" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-gray-800">לוח התאמות</h1>
                <p className="text-gray-600">ניהול ובקרה על כל התאמות החשבונות של הלקוחות.</p>
            </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleGenerateReconciliationTasks}
            disabled={isGeneratingTasks}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
            {isGeneratingTasks ? 'יוצר משימות...' : 'צור משימות התאמות'}
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
            setEditingReconciliation(null); // Ensure no old data if adding new
            setIsFormOpen(true);
          }}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף התאמה חדשה
          </Button>
        </div>
      </motion.div>

      {/* הודעת תוצאת יצירת משימות */}
      {generationResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border ${
            generationResult.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {generationResult.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{generationResult.message}</span>
          </div>
          
          {generationResult.details && generationResult.type === 'success' && (
            <div className="text-sm">
              <p>משימות נוצרו: {generationResult.details.summary.tasksCreated}</p>
              <p>משימות דולגו (כבר קיימות): {generationResult.details.summary.tasksSkipped}</p>
              {generationResult.details.reconciliations && generationResult.details.reconciliations.length > 0 && (
                <div className="mt-2">
                  <strong>משימות חדשות שנוצרו:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {generationResult.details.reconciliations.map((item, index) => (
                      <li key={index}>{item.taskTitle}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setGenerationResult(null)}
            className="mt-2 p-0 h-auto"
          >
            סגור הודעה
          </Button>
        </motion.div>
      )}

      <Card>
        <CardHeader><CardTitle>התקדמות כוללת</CardTitle></CardHeader>
        <CardContent>
          <Progress value={progress} className="w-full" color="bg-teal-500" />
          <p className="text-center mt-2 text-sm text-gray-600">{Math.round(progress)}% הושלמו</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5"/> סינון</CardTitle>
          <div className="flex flex-col md:flex-row gap-4 mt-4">
              <Select onValueChange={(value) => setFilters(f => ({ ...f, status: value }))} value={filters.status}>
                <SelectTrigger><SelectValue placeholder="סנן לפי סטטוס" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setFilters(f => ({ ...f, client: value }))} value={filters.client}>
                <SelectTrigger><SelectValue placeholder="סנן לפי לקוח" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הלקוחות</SelectItem>
                  {clients.map(client => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                </SelectContent>
              </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Client accounts overview */}
      {!isLoading && accountsSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Landmark className="w-5 h-5" /> חשבונות לקוחות ({allAccounts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-2 font-semibold">לקוח</th>
                    <th className="text-right p-2 font-semibold">חשבונות בנק</th>
                    <th className="text-right p-2 font-semibold">כרטיסי אשראי</th>
                    <th className="text-right p-2 font-semibold">אחר</th>
                    <th className="text-center p-2 font-semibold">סה״כ</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsSummary.map(({ client, accounts }) => {
                    const banks = accounts.filter(a => a.account_type === 'bank');
                    const cards = accounts.filter(a => a.account_type === 'credit_card');
                    const other = accounts.filter(a => a.account_type !== 'bank' && a.account_type !== 'credit_card');
                    return (
                      <tr key={client.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{client.name}</td>
                        <td className="p-2">
                          {banks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {banks.map(a => (
                                <Badge key={a.id} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  <Landmark className="w-3 h-3 ml-1" />
                                  {a.account_name || a.bank_name || 'חשבון'}
                                </Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </td>
                        <td className="p-2">
                          {cards.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {cards.map(a => (
                                <Badge key={a.id} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  <CreditCard className="w-3 h-3 ml-1" />
                                  {a.account_name || 'כרטיס'}
                                </Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </td>
                        <td className="p-2">
                          {other.length > 0 ? (
                            <span className="text-xs">{other.length} חשבונות</span>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </td>
                        <td className="p-2 text-center font-semibold">{accounts.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"></Card>)}
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={['bank_credit', 'internal']} className="space-y-6">
          <AccordionItem value="bank_credit" className="border-none">
            <Card className="overflow-hidden">
              <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:no-underline">
                <CardTitle className="flex items-center gap-3 text-gray-700">
                  <Landmark/> התאמות בנק ואשראי
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bankCreditRecs.length === 0 ? (
                    <p className="text-gray-500 col-span-full text-center">אין התאמות בנק ואשראי מסוג זה.</p>
                  ) : (
                    <AnimatePresence>
                      {bankCreditRecs.map(rec => <ReconciliationCard key={rec.id} rec={rec} onStatusChange={handleStatusChange} onEdit={(r) => { setEditingReconciliation(r); setIsFormOpen(true); }} />)}
                    </AnimatePresence>
                  )}
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="internal" className="border-none">
             <Card className="overflow-hidden">
               <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:no-underline">
                 <CardTitle className="flex items-center gap-3 text-gray-700">
                   <Briefcase/> התאמות פנימיות
                 </CardTitle>
               </AccordionTrigger>
               <AccordionContent className="p-6 space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600"/> התאמות לקוחות
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {internalRecs.clients.length === 0 ? (
                        <p className="text-gray-500 col-span-full text-center">אין התאמות לקוחות מסוג זה.</p>
                      ) : (
                        <AnimatePresence>
                          {internalRecs.clients.map(rec => <ReconciliationCard key={rec.id} rec={rec} onStatusChange={handleStatusChange} onEdit={(r) => { setEditingReconciliation(r); setIsFormOpen(true); }} />)}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-green-600"/> התאמות ספקים
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {internalRecs.suppliers.length === 0 ? (
                        <p className="text-gray-500 col-span-full text-center">אין התאמות ספקים מסוג זה.</p>
                      ) : (
                        <AnimatePresence>
                          {internalRecs.suppliers.map(rec => <ReconciliationCard key={rec.id} rec={rec} onStatusChange={handleStatusChange} onEdit={(r) => { setEditingReconciliation(r); setIsFormOpen(true); }} />)}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-purple-600"/> התאמות מוסדות
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {internalRecs.institutions.length === 0 ? (
                        <p className="text-gray-500 col-span-full text-center">אין התאמות מוסדות מסוג זה.</p>
                      ) : (
                        <AnimatePresence>
                          {internalRecs.institutions.map(rec => <ReconciliationCard key={rec.id} rec={rec} onStatusChange={handleStatusChange} onEdit={(r) => { setEditingReconciliation(r); setIsFormOpen(true); }} />)}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
               </AccordionContent>
             </Card>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
