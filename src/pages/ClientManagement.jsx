
import React, { useState, useEffect } from 'react';
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
  AlertTriangle
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
import ClientServiceProvidersTab from '@/components/clients/ClientServiceProvidersTab';

export default function ClientManagementPage() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);

  const [view, setView] = useState('grid');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedAccountsClient, setSelectedAccountsClient] = useState(null);
  const [selectedCollectionsClient, setSelectedCollectionsClient] = useState(null);
  const [selectedContractsClient, setSelectedContractsClient] = useState(null);
  const [selectedTasksClient, setSelectedTasksClient] = useState(null);
  const [selectedServiceProvidersClient, setSelectedServiceProvidersClient] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

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
      // CRITICAL FIX: Override the default read limit by explicitly requesting up to 500 records.
      const clientsData = await Client.list(null, 500); 
      console.log('🔍 RAW CLIENTS FROM DB (WITH LIMIT OVERRIDE):', {
        total: clientsData.length,
        statusBreakdown: clientsData.reduce((acc, client) => {
          acc[client.status || 'undefined'] = (acc[client.status || 'undefined'] || 0) + 1;
          return acc;
        }, {})
      });
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      setError('שגיאה בטעינת לקוחות');
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
      onboarding_pending: clients.filter(c => c.status === 'onboarding_pending').length,
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


  const handleSaveClient = async (clientData) => {
    const isNew = !selectedClient?.id;
    try {
      if (isNew) {
        const onboarding_link_id = crypto.randomUUID();
        await Client.create({ ...clientData, status: 'potential', onboarding_link_id });
      } else {
        await Client.update(selectedClient.id, clientData);
      }
      setSelectedClient(null);
      setShowClientForm(false);
      await loadClients();
    } catch (error) {
      console.error("Error saving client:", error);
      setError('שגיאה בשמירת לקוח');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו בלתי הפיכה.")) {
      try {
        await Client.delete(clientId);
        await loadClients();
      } catch (error) {
        console.error("Error deleting client:", error);
        setError('שגיאה במחיקת לקוח');
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

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold text-yellow-800 mb-2">🔍 DEBUG: Client Status Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
          <div>כל הלקוחות: <strong>{statusCounts.all}</strong></div>
          <div>פעילים: <strong>{statusCounts.active}</strong></div>
          <div>לא פעילים: <strong>{statusCounts.inactive}</strong></div>
          <div>פוטנציאליים: <strong>{statusCounts.potential}</strong></div>
          <div>לקוחות עבר: <strong>{statusCounts.former}</strong></div>
          <div>ממתינים לקליטה: <strong>{statusCounts.onboarding_pending}</strong></div>
        </div>
      </div>

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
          <Button size="sm" onClick={handleAddNewClient} className="bg-primary hover:bg-accent text-white">
            <Plus className="w-4 h-4 ml-2" />
            הוסף לקוח
          </Button>
        </div>
      </motion.div>

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
                <SelectItem value="former">לקוח עבר ({statusCounts.former})</SelectItem>
                <SelectItem value="onboarding_pending">ממתין לקליטה ({statusCounts.onboarding_pending})</SelectItem>
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
                      onEdit={(c) => { setSelectedClient(c); setShowClientForm(true); }}
                      onSelectTasks={setSelectedTasksClient}
                      onSelectAccounts={setSelectedAccountsClient}
                      onSelectCollections={setSelectedCollectionsClient}
                      onSelectContracts={setSelectedContractsClient}
                      onSelectServiceProviders={setSelectedServiceProvidersClient}
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

      {/* Client Form Modal */}
      <Dialog open={showClientForm} onOpenChange={(open) => {
        if (!open) {
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
              setSelectedClient(null);
              setShowClientForm(false);
            }}
            onClientUpdate={loadClients}
          />
        </DialogContent>
      </Dialog>

      {/* Client Accounts Manager Modal */}
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

      {/* Client Collections Modal */}
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

      {/* Client Contracts Manager Modal */}
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

      {/* Client Tasks Tab Modal */}
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

      {/* Client Service Providers Modal */}
      <Dialog open={!!selectedServiceProvidersClient} onOpenChange={(open) => {
        if (!open) setSelectedServiceProvidersClient(null);
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>נותני שירות עבור {selectedServiceProvidersClient?.name}</DialogTitle>
            <DialogDescription>ניהול רו"ח, עו"ד, סוכני ביטוח ונותני שירות אחרים.</DialogDescription>
          </DialogHeader>
          {selectedServiceProvidersClient && <ClientServiceProvidersTab clientId={selectedServiceProvidersClient.id} clientName={selectedServiceProvidersClient.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
