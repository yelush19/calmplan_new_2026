
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; // Added Label import

import {
  Users,
  Plus,
  Search,
  List,
  LayoutGrid,
  RefreshCw,
  Download,
  Upload,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  X,
  AlertTriangle,
  CheckSquare, // Added
  Square // Added
} from 'lucide-react';
import { Client } from '@/api/entities';
import { mondayApi } from '@/api/functions';
import { exportClientsToExcel } from '@/api/functions';
import { importClientsFromExcel } from '@/api/functions';
import { exportClientAccountsTemplate } from '@/api/functions';
import { importClientAccounts } from '@/api/functions';
import ClientForm from '@/components/clients/ClientForm';
import ClientCard from '@/components/clients/ClientCard';
import ClientAccountsManager from '@/components/clients/ClientAccountsManager';
import ClientListItem from '@/components/clients/ClientListItem';
import ClientCollections from '@/components/clients/ClientCollections';
import ClientContractsManager from '@/components/clients/ClientContractsManager';
import ClientTasksTab from '@/components/clients/ClientTasksTab';
import MondayDataImport from '@/components/clients/MondayDataImport';

// Helper: retry with exponential backoff for rate limits
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error?.response?.status === 429 || 
                         error?.message?.toLowerCase().includes('rate limit') ||
                         error?.message?.toLowerCase().includes('429');
      
      if (!isRateLimit || attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Rate limit hit, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export default function ClientManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [view, setView] = useState('grid');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedAccountsClient, setSelectedAccountsClient] = useState(null);
  const [selectedCollectionsClient, setSelectedCollectionsClient] = useState(null);
  const [selectedContractsClient, setSelectedContractsClient] = useState(null);
  const [selectedTasksClient, setSelectedTasksClient] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Bulk selection state
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState('active');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  // Auto-open client card from URL param (e.g. from ClientsDashboard link)
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && clients.length > 0 && !showClientForm) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
        setShowClientForm(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [clients, searchParams]);

  useEffect(() => {
    console.log('🔍 FILTERING CLIENTS:', {
      totalClients: clients.length,
      statusFilter,
      searchTerm
    });

    let tempClients = [...clients];

    if (statusFilter !== 'all') {
      tempClients = tempClients.filter(client => client.status === statusFilter);
      console.log(`📊 After status filter (${statusFilter}):`, tempClients.length);
    }

    if (searchTerm) {
      tempClients = tempClients.filter(client =>
        client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.contacts && client.contacts.some(contact =>
          contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.phone?.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
      console.log(`🔍 After search filter:`, tempClients.length);
    }
    
    tempClients.sort((a, b) => a.name.localeCompare(b.name, 'he'));

    console.log('✅ FINAL FILTERED CLIENTS:', tempClients.length);
    setFilteredClients(tempClients);
  }, [clients, statusFilter, searchTerm]);

  const loadClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clientsData = await retryWithBackoff(() => Client.list(null, 500));
      console.log('🔍 RAW CLIENTS FROM DB (WITH LIMIT OVERRIDE):', {
        total: clientsData.length,
        statusBreakdown: clientsData.reduce((acc, client) => {
          acc[client.status || 'undefined'] = (acc[client.status || 'undefined'] || 0) + 1;
          return acc;
        }, {})
      });
      setClients(clientsData || []);
      setSelectedClientIds(new Set()); // Clear selection on reload
    } catch (error) {
      console.error("Error loading clients:", error);
      const errorMsg = error?.response?.status === 429 
        ? 'יותר מדי בקשות - המערכת עמוסה. אנא נסה שוב בעוד מספר שניות.'
        : 'שגיאה בטעינת לקוחות';
      setError(errorMsg);
      setClients([]);
    }
    setIsLoading(false);
  };

  const getStatusCounts = () => {
    const counts = {
      all: clients.length,
      active: clients.filter(c => c.status === 'active').length,
      inactive: clients.filter(c => c.status === 'inactive').length,
      potential: clients.filter(c => c.status === 'potential').length,
      former: clients.filter(c => c.status === 'former').length,
      development: clients.filter(c => c.status === 'development').length,
      onboarding_pending: clients.filter(c => c.status === 'onboarding_pending').length,
      balance_sheet_only: clients.filter(c => c.status === 'balance_sheet_only').length,
    };

    console.log('📊 STATUS COUNTS:', counts);
    return counts;
  };
  const statusCounts = getStatusCounts();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const response = await mondayApi({ action: 'syncClients' });
      if (response && response.data && response.data.success) {
        setSyncMessage({ type: 'success', message: 'סנכרון Monday הושלם בהצלחה.', details: response.data.log });
      } else {
        setSyncMessage({ type: 'error', message: 'שגיאה בסנכרון Monday.', details: response.data?.log || [response.data?.error || 'שגיאה לא ידועה'] });
      }
      await loadClients();
    } catch (error) {
      console.error("Error syncing with Monday:", error);
      setSyncMessage({ type: 'error', message: 'שגיאה קריטית בסנכרון Monday.', details: [error.message] });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, headers } = await exportClientsToExcel();
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Error exporting clients:", error);
      alert('שגיאה בייצוא הלקוחות');
    }
    setIsExporting(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data, headers } = await exportClientAccountsTemplate();
      const blob = new Blob([data], { type: headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bank_accounts_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Error downloading template:", error);
      alert('שגיאה בהורדת התבנית');
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const response = await importClientsFromExcel({ file });
      console.log('Import result:', response.data);
      alert(`הייבוא הושלם בהצלחה!\nנוצרו: ${response.data.created} לקוחות\nעודכנו: ${response.data.updated} לקוחות\nשגיאות: ${response.data.errors?.length || 0}`);
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Import errors:', response.data.errors);
      }
      await loadClients();
    } catch (error) {
      console.error("Error importing clients:", error);
      alert("שגיאה בייבוא הקובץ");
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleImportAccounts = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const response = await importClientAccounts({ file });
      console.log('Import result:', response.data);
      alert(`הייבוא הושלם בהצלחה!\nנוצרו: ${response.data.created} חשבונות\nעודכנו: ${response.data.updated} חשבונות`);
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Import errors:', response.data.errors);
        alert(`שגיאות:\n${response.data.errors.join('\n')}`);
      }
      event.target.value = '';
      await loadClients();
    } catch (error) {
      console.error("Error importing accounts:", error);
      alert("שגיאה בייבוא הקובץ");
    } finally {
      setIsImporting(false);
    }
  };

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleToggleSelectClient = (clientId) => {
    const newSelected = new Set(selectedClientIds);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClientIds(newSelected);
  };

  const handleBulkStatusChange = async () => {
    if (selectedClientIds.size === 0) return;

    setIsBulkUpdating(true);
    setError(null);

    try {
      const updatePromises = Array.from(selectedClientIds).map(clientId =>
        retryWithBackoff(() => Client.update(clientId, { status: bulkNewStatus }), 2, 1500)
      );

      await Promise.all(updatePromises);

      // Push status changes to Monday.com in background
      const allClients = await Client.list();
      for (const clientId of selectedClientIds) {
        const client = allClients.find(c => c.id === clientId);
        if (client?.monday_board_id && client?.monday_item_id) {
          mondayApi({
            action: 'pushClientToMonday',
            clientId,
            boardId: client.monday_board_id,
          }).catch(err => console.warn('⚠️ סנכרון ל-Monday נכשל:', err.message));
        }
      }

      alert(`✅ עודכנו ${selectedClientIds.size} לקוחות לסטטוס "${statusLabels[bulkNewStatus]}"`);
      setSelectedClientIds(new Set());
      setShowBulkStatusDialog(false);
      await loadClients();
    } catch (error) {
      console.error("Error bulk updating clients:", error);
      const errorMsg = error?.response?.status === 429
        ? 'יותר מדי פעולות בזמן קצר. אנא המתן ונסה שוב.'
        : `שגיאה בעדכון מרובה: ${error?.message || 'שגיאה לא ידועה'}`;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const statusLabels = {
    active: 'פעיל',
    inactive: 'לא פעיל',
    potential: 'פוטנציאלי',
    former: 'עבר',
    development: 'פיתוח',
    onboarding_pending: 'ממתין לקליטה',
    balance_sheet_only: 'סגירת מאזן בלבד'
  };

  const handleSaveClient = async (clientData) => {
    const isNew = !selectedClient?.id;
    setIsSaving(true);
    setError(null);

    try {
      let savedClientId = selectedClient?.id;
      await retryWithBackoff(async () => {
        if (isNew) {
          const onboarding_link_id = crypto.randomUUID();
          const created = await Client.create({ ...clientData, status: 'potential', onboarding_link_id });
          savedClientId = created.id;
        } else {
          await Client.update(selectedClient.id, clientData);
        }
      }, 3, 2000);

      // Push to Monday.com in background (don't block UI)
      if (savedClientId) {
        const boardId = clientData.monday_board_id || selectedClient?.monday_board_id;
        if (boardId) {
          mondayApi({
            action: 'pushClientToMonday',
            clientId: savedClientId,
            boardId,
          }).then(res => {
            if (res.data?.success) {
              console.log('✅ סנכרון ל-Monday הצליח:', res.data.result?.action);
            } else {
              console.warn('⚠️ סנכרון ל-Monday נכשל:', res.data?.error);
            }
          }).catch(err => {
            console.warn('⚠️ סנכרון ל-Monday נכשל:', err.message);
          });
        }
      }

      setSelectedClient(null);
      setShowClientForm(false);
      await loadClients();
    } catch (error) {
      console.error("Error saving client:", error);
      const isRateLimit = error?.response?.status === 429 ||
                         error?.message?.toLowerCase().includes('rate limit') ||
                         error?.message?.toLowerCase().includes('429');

      const errorMsg = isRateLimit
        ? 'יותר מדי פעולות בזמן קצר. אנא המתן מספר שניות ונסה שוב.'
        : `שגיאה בשמירת לקוח: ${error?.message || 'שגיאה לא ידועה'}`;

      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו בלתי הפיכה.")) {
      try {
        await retryWithBackoff(() => Client.delete(clientId), 3, 2000);
        await loadClients();
      } catch (error) {
        console.error("Error deleting client:", error);
        const errorMsg = error?.response?.status === 429
          ? 'יותר מדי פעולות בזמן קצר. אנא המתן מספר שניות ונסה שוב.'
          : 'שגיאה במחיקת לקוח';
        setError(errorMsg);
        alert(errorMsg);
      }
    }
  };

  const handleAddNewClient = () => {
    setSelectedClient({
      name: '',
      contacts: [],
      service_types: [],
      status: 'potential',
    });
    setShowClientForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Debug section removed for production */}

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">
              ניהול לקוחות ({filteredClients.length} מתוך {clients.length})
            </h1>
            <p className="text-neutral-medium">מערכת CRM מתקדמת לניהול לקוחות ותהליכים</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
          <Button onClick={loadClients} variant="outline" size="sm" disabled={isLoading || isSyncing}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 ml-2" />
                תבניות
                <ChevronDown className="w-4 h-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 ml-2" />
                תבנית חשבונות בנק
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                <Download className="w-4 h-4 ml-2" />
                ייצוא לקוחות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isImporting}>
                <Upload className={`w-4 h-4 ml-2 ${isImporting ? 'animate-spin' : ''}`} />
                ייבוא
                <ChevronDown className="w-4 h-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <label htmlFor="import-accounts" className="cursor-pointer flex items-center w-full">
                  <Upload className="w-4 h-4 ml-2" />
                  ייבוא חשבונות בנק
                  <input
                    type="file"
                    id="import-accounts"
                    onChange={handleImportAccounts}
                    className="hidden"
                    accept=".xlsx, .xls"
                    disabled={isImporting}
                  />
                </label>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <label htmlFor="import-clients" className="cursor-pointer flex items-center w-full">
                  <Upload className="w-4 h-4 ml-2" />
                  ייבוא לקוחות
                  <input
                    type="file"
                    id="import-clients"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                    disabled={isImporting}
                  />
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`w-4 h-4 ml-2 ${isSyncing ? 'animate-spin' : ''}`} />
            סנכרן Monday
          </Button>
          <Button size="sm" onClick={handleAddNewClient} className="bg-primary hover:bg-accent text-white" disabled={isSaving}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף לקוח
          </Button>
        </div>
      </motion.div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedClientIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">
                  נבחרו {selectedClientIds.size} לקוחות
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedClientIds(new Set())}
                >
                  ביטול בחירה
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 ml-2" />
                  שנה סטטוס
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {syncMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-4"
        >
          <Alert variant={syncMessage.type === 'success' ? 'default' : 'destructive'} className={`${syncMessage.type === 'success' ? 'bg-green-100 border-green-300' : ''} relative`}>
            {syncMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{syncMessage.message}</AlertTitle>
            {syncMessage.details && (
              <AlertDescription className="max-h-24 overflow-y-auto text-xs whitespace-pre-wrap">
                {syncMessage.details.join('\n')}
              </AlertDescription>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 h-6 w-6"
              onClick={() => setSyncMessage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        </motion.div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>שגיאה!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 h-6 w-6"
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      <MondayDataImport onComplete={loadClients} />

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חיפוש לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סנן לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים ({statusCounts.all})</SelectItem>
                <SelectItem value="active">פעיל ({statusCounts.active})</SelectItem>
                <SelectItem value="inactive">לא פעיל ({statusCounts.inactive})</SelectItem>
                <SelectItem value="potential">פוטנציאלי ({statusCounts.potential})</SelectItem>
                <SelectItem value="former">עבר ({statusCounts.former})</SelectItem>
                <SelectItem value="development">פיתוח ({statusCounts.development})</SelectItem>
                <SelectItem value="onboarding_pending">ממתין לקליטה ({statusCounts.onboarding_pending})</SelectItem>
                <SelectItem value="balance_sheet_only">סגירת מאזן בלבד ({statusCounts.balance_sheet_only})</SelectItem>
              </SelectContent>
            </Select>

            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value)} className="hidden md:flex">
              <ToggleGroupItem value="grid" aria-label="תצוגת רשת">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="תצוגת רשימה">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Select All Checkbox */}
            {!isLoading && filteredClients.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                className="gap-2"
              >
                {selectedClientIds.size === filteredClients.length && filteredClients.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectedClientIds.size === filteredClients.length && filteredClients.length > 0 ? 'בטל הכל' : 'בחר הכל'}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">טוען לקוחות...</div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {view === 'grid' ? (
                <motion.div
                  key="grid-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  {filteredClients.map(client => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      isSelected={selectedClientIds.has(client.id)}
                      onToggleSelect={() => handleToggleSelectClient(client.id)}
                      onEdit={(c) => { setSelectedClient(c); setShowClientForm(true); }}
                      onSelectTasks={setSelectedTasksClient}
                      onSelectAccounts={setSelectedAccountsClient}
                      onSelectCollections={setSelectedCollectionsClient}
                      onSelectContracts={setSelectedContractsClient}
                      onDelete={() => handleDeleteClient(client.id)}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {filteredClients.map(client => (
                          <ClientListItem
                            key={client.id}
                            client={client}
                            isSelected={selectedClientIds.has(client.id)}
                            onToggleSelect={() => handleToggleSelectClient(client.id)}
                            onEdit={(c) => { setSelectedClient(c); setShowClientForm(true); }}
                            onSelectTasks={setSelectedTasksClient}
                            onSelectAccounts={setSelectedAccountsClient}
                            onSelectCollections={setSelectedCollectionsClient}
                            onSelectContracts={setSelectedContractsClient}
                            onDelete={() => handleDeleteClient(client.id)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {!isLoading && clients.length > 0 && filteredClients.length === 0 && (
            <Card className="p-12 text-center">
              <Search className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לקוחות תואמים</h3>
              <p className="text-gray-500 mb-4">נסה לשנות את פרמטרי החיפוש או הסינון.</p>
            </Card>
          )}

          {!isLoading && clients.length === 0 && (
            <Card className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לקוחות</h3>
              <p className="text-gray-500 mb-4">התחל על ידי הוספת הלקוח הראשון שלך או סנכרון עם Monday.com.</p>
              <Button onClick={handleAddNewClient} className="bg-primary hover:bg-accent text-white">
                <Plus className="w-4 h-4 ml-2" />
                הוסף לקוח ראשון
              </Button>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Bulk Status Change Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שינוי סטטוס ל-{selectedClientIds.size} לקוחות</DialogTitle>
            <DialogDescription>
              בחר את הסטטוס החדש עבור הלקוחות שנבחרו
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="bulk-status">סטטוס חדש</Label>
              <Select value={bulkNewStatus} onValueChange={setBulkNewStatus}>
                <SelectTrigger id="bulk-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                  <SelectItem value="potential">פוטנציאלי</SelectItem>
                  <SelectItem value="former">עבר</SelectItem>
                  <SelectItem value="development">פיתוח</SelectItem>
                  <SelectItem value="onboarding_pending">ממתין לקליטה</SelectItem>
                  <SelectItem value="balance_sheet_only">סגירת מאזן בלבד</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                פעולה זו תעדכן את הסטטוס של {selectedClientIds.size} לקוחות ל"{statusLabels[bulkNewStatus]}"
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkStatusDialog(false)}
              disabled={isBulkUpdating}
            >
              ביטול
            </Button>
            <Button
              onClick={handleBulkStatusChange}
              disabled={isBulkUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isBulkUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                  מעדכן...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 ml-2" />
                  עדכן סטטוס
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClientForm} onOpenChange={(open) => {
        if (!open && !isSaving) {
          setSelectedClient(null);
          setShowClientForm(false);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedClient?.id ? `עריכת לקוח: ${selectedClient.name}` : 'יצירת לקוח חדש'}</DialogTitle>
            <DialogDescription>
              {selectedClient?.id ? 'עדכן את פרטי הלקוח.' : 'מלא את הפרטים ליצירת לקוח חדש.'}
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            client={selectedClient}
            onSubmit={handleSaveClient}
            onCancel={() => {
              if (!isSaving) {
                setSelectedClient(null);
                setShowClientForm(false);
              }
            }}
            onClientUpdate={loadClients}
          />
          {isSaving && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium">שומר...</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAccountsClient} onOpenChange={(open) => {
        if (!open) setSelectedAccountsClient(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>חשבונות בנק עבור {selectedAccountsClient?.name}</DialogTitle>
            <DialogDescription>ניהול חשבונות הבנק המשויכים ללקוח.</DialogDescription>
          </DialogHeader>
          {selectedAccountsClient && <ClientAccountsManager clientId={selectedAccountsClient.id} clientName={selectedAccountsClient.name} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCollectionsClient} onOpenChange={(open) => {
        if (!open) setSelectedCollectionsClient(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>גבייה עבור {selectedCollectionsClient?.name}</DialogTitle>
            <DialogDescription>ניהול פרטי הגבייה עבור הלקוח.</DialogDescription>
          </DialogHeader>
          {selectedCollectionsClient && <ClientCollections clientId={selectedCollectionsClient.id} clientName={selectedCollectionsClient.name} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedContractsClient} onOpenChange={(open) => {
        if (!open) setSelectedContractsClient(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>חוזים עבור {selectedContractsClient?.name}</DialogTitle>
            <DialogDescription>ניהול חוזים והסכמים עם הלקוח.</DialogDescription>
          </DialogHeader>
          {selectedContractsClient && <ClientContractsManager clientId={selectedContractsClient.id} clientName={selectedContractsClient.name} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTasksClient} onOpenChange={(open) => {
        if (!open) setSelectedTasksClient(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>משימות עבור {selectedTasksClient?.name}</DialogTitle>
            <DialogDescription>ניהול משימות הקשורות ללקוח.</DialogDescription>
          </DialogHeader>
          {selectedTasksClient && <ClientTasksTab clientId={selectedTasksClient.id} clientName={selectedTasksClient.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
