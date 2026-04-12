
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; // Added Label import

import {
  Users,
  Plus,
  Search,
  List,
  LayoutGrid,
  BookOpen,
  RefreshCw,
  Download,
  Upload,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  X,
  AlertTriangle,
  CheckSquare, // Added
  Square, // Added
  FolderKanban
} from 'lucide-react';
import { Client, Project, PeriodicReport, BalanceSheet, Task, AccountReconciliation, ClientAccount, Lead } from '@/api/entities';
// mondayApi removed (Kill Monday directive)
import { exportClientsToExcel, exportCustomerServicesCSV } from '@/api/functions';
import { importClientsFromExcel } from '@/api/functions';
import { exportClientAccountsTemplate } from '@/api/functions';
import { importClientAccounts } from '@/api/functions';
import ClientForm from '@/components/clients/ClientForm';
import ClientCard from '@/components/clients/ClientCard';
import ClientAccountsManager from '@/components/clients/ClientAccountsManager';
import ClientListItem from '@/components/clients/ClientListItem';
const ClientWorkbookEmbed = React.lazy(() => import('@/pages/ClientWorkbook'));
import { loadAutomationRules, getReportAutoCreateRules, clientHasServiceForCategory, loadServiceDueDates, getDueDayForCategory } from '@/config/automationRules';
import { ALL_SERVICES } from '@/config/processTemplates';
import ClientCollections from '@/components/clients/ClientCollections';
import ClientContractsManager from '@/components/clients/ClientContractsManager';
import ClientTasksTab from '@/components/clients/ClientTasksTab';
// MondayDataImport removed (Kill Monday directive)
import ClientFilesManager from '@/components/files/ClientFilesManager';
import ClientServiceProvidersTab from '@/components/clients/ClientServiceProvidersTab';
import MultiStatusFilter from '@/components/ui/MultiStatusFilter';

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
  const [statusFilter, setStatusFilter] = useState(['active']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [view, setView] = useState('grid');
  const [allCardsOpen, setAllCardsOpen] = useState(true); // Controls all cards open/collapsed
  const [selectedClient, setSelectedClient] = useState(null); // old data for diff in handleSaveClient
  const [selectedPanelClient, setSelectedPanelClient] = useState(null);
  const [panelTab, setPanelTab] = useState('details');
  const [selectedCollectionsClient, setSelectedCollectionsClient] = useState(null);
  const [selectedContractsClient, setSelectedContractsClient] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // Monday import removed — CalmPlan DNA is source of truth

  // Bulk selection state
  const [selectedClientIds, setSelectedClientIds] = useState(new Set());
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState('active');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isMigratingDev, setIsMigratingDev] = useState(false);
  const devMigrationDone = useRef(false);
  const [automationRules, setAutomationRules] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set()); // All groups start OPEN

  // Smart pagination — 15 clients visible per status group by default (ADHD-friendly)
  const CLIENTS_PAGE_SIZE = 15;
  const [visibleCountByGroup, setVisibleCountByGroup] = useState({});

  const handleShowMoreInGroup = useCallback((status) => {
    setVisibleCountByGroup(prev => ({
      ...prev,
      [status]: (prev[status] || CLIENTS_PAGE_SIZE) + CLIENTS_PAGE_SIZE,
    }));
  }, []);

  // Reset pagination when filters/search change
  useEffect(() => {
    setVisibleCountByGroup({});
  }, [searchTerm, statusFilter]);

  const handleMigrateDevToProjects = async (clientsList) => {
    const devClients = (clientsList || clients).filter(c => c.status === 'development');
    if (devClients.length === 0) return;
    setIsMigratingDev(true);
    try {
      const existingProjects = await Project.list(null, 500);
      const existingNames = new Set(existingProjects.map(p => p.name));

      for (const client of devClients) {
        if (!existingNames.has(client.name)) {
          await Project.create({
            name: client.name,
            status: 'in_development',
            system_type: 'web_app',
            notes: client.notes || '',
          });
        }
        await Client.delete(client.id);
      }
      await loadClients();
    } catch (err) {
      console.error('שגיאה בהעברת לקוחות פיתוח:', err);
      setError('שגיאה בהעברת לקוחות פיתוח לפרויקטים');
    }
    setIsMigratingDev(false);
  };

  useEffect(() => {
    loadClients();
    loadAutomationRules().then(({ rules }) => setAutomationRules(rules));
  }, []);

  const openPanel = (client, tab = 'details') => {
    setSelectedPanelClient(client);
    setPanelTab(tab);
  };
  const closePanel = () => {
    if (!isSaving) {
      setSelectedPanelClient(null);
      setSelectedClient(null);
      setPanelTab('details');
    }
  };

  // Auto-open client card from URL param (e.g. from ClientsDashboard link)
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && clients.length > 0 && !selectedPanelClient) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
        openPanel(client, 'details');
        setSearchParams({}, { replace: true });
      }
    }
  }, [clients, searchParams]);

  useEffect(() => {
    let tempClients = [...clients];

    if (statusFilter.length > 0) {
      tempClients = tempClients.filter(client => statusFilter.includes(client.status));
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      tempClients = tempClients.filter(client => {
        // Name + entity number
        if (client.name?.toLowerCase().includes(q)) return true;
        if (client.entity_number && String(client.entity_number).toLowerCase().includes(q)) return true;
        // Contacts
        if (client.contacts?.some(c =>
          c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
        )) return true;
        // Tax info fields (תיק ניכויים, מע"מ, ביטוח לאומי, etc.)
        const ti = client.tax_info || {};
        const taxFields = [
          ti.tax_id, ti.vat_file_number, ti.tax_deduction_file_number,
          ti.social_security_file_number, ti.income_tax_file_number,
          ti.annual_tax_ids?.deductions_id, ti.annual_tax_ids?.social_security_id,
          ti.annual_tax_ids?.tax_advances_id,
        ];
        if (taxFields.some(v => v && String(v).toLowerCase().includes(q))) return true;
        // Notes
        if (client.notes && String(client.notes).toLowerCase().includes(q)) return true;
        return false;
      });
    }
    
    tempClients.sort((a, b) => a.name.localeCompare(b.name, 'he'));

    setFilteredClients(tempClients);
  }, [clients, statusFilter, searchTerm]);

  const loadClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clientsData = await retryWithBackoff(() => Client.list(null, 500));
      setClients(clientsData || []);
      setSelectedClientIds(new Set()); // Clear selection on reload
      // Auto-migrate development clients to projects (one-time)
      if (!devMigrationDone.current) {
        const devClients = (clientsData || []).filter(c => c.status === 'development');
        if (devClients.length > 0) {
          devMigrationDone.current = true;
          handleMigrateDevToProjects(clientsData);
        }
      }
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

    return counts;
  };
  const statusCounts = getStatusCounts();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Monday sync removed — data comes from CalmPlan DNA
      setSyncMessage({ type: 'success', message: 'נתונים נטענים ממקור האפיון (DNA).' });
      await loadClients();
    } catch (error) {
      console.error("Error loading data:", error);
      setSyncMessage({ type: 'error', message: 'שגיאה בטעינת נתונים.', details: [error.message] });
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

  const handleExportCustomerServices = async () => {
    setIsExporting(true);
    try {
      const result = await exportCustomerServicesCSV();
      if (result.success) {
        console.log(`Exported ${result.count} rows`);
      }
    } catch (error) {
      console.error("Error exporting customer services:", error);
      alert('שגיאה בייצוא שירותי לקוחות');
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

      // Monday push removed — DNA is sole source of truth

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

  // Group clients by status for collapsible sections
  const STATUS_ORDER = ['active', 'onboarding_pending', 'potential', 'balance_sheet_only', 'inactive', 'former', 'development'];
  const groupedClients = React.useMemo(() => {
    const groups = {};
    for (const client of filteredClients) {
      const status = client.status || 'active';
      if (!groups[status]) groups[status] = [];
      groups[status].push(client);
    }
    return STATUS_ORDER.filter(s => groups[s]?.length > 0).map(s => ({
      status: s,
      label: statusLabels[s] || s,
      clients: groups[s],
    }));
  }, [filteredClients]);

  const toggleGroup = (status) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Auto-create periodic reports and balance sheets for new/updated active clients
  const autoCreateReportsForClient = async (clientId, clientName, clientData) => {
    const services = clientData.service_types || [];
    const year = String(new Date().getFullYear() - 1);
    const now = new Date();
    // Reporting period = previous month
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const reportingMonthEnd = new Date(prevMonthYear, prevMonth + 1, 0);
    const monthLabel = reportingMonthEnd.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const reportingMonthStr = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    // Deadline month = current month (due dates go here)
    const deadlineMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const deadlineMonthEndStr = deadlineMonthEnd.toISOString().split('T')[0];
    const dueDateStr = deadlineMonthEndStr; // backward compat

    try {
      const matchingRules = getReportAutoCreateRules(automationRules, services, clientData);

      for (const rule of matchingRules) {
        // --- PeriodicReport ---
        if (rule.target_entity === 'PeriodicReport' && rule.report_types) {
          const existingReports = await PeriodicReport.list(null, 2000).catch(() => []);
          const clientReports = existingReports.filter(r => r.client_id === clientId && r.report_year === year);
          if (clientReports.length === 0) {
            for (const [typeKey, periods] of Object.entries(rule.report_types)) {
              for (const period of periods) {
                const y = parseInt(year);
                const targetDate = period === 'h1' ? `${y}-07-18` : period === 'h2' ? `${y + 1}-01-18` : `${y + 1}-04-30`;
                await PeriodicReport.create({
                  client_id: clientId, client_name: clientName,
                  report_year: year, report_type: typeKey, period,
                  target_date: targetDate, status: 'not_started',
                  reconciliation_steps: { payroll_vs_bookkeeping: false, periodic_vs_annual: false },
                  submission_date: '', notes: '',
                });
              }
            }
          }
        }

        // --- BalanceSheet ---
        if (rule.target_entity === 'BalanceSheet') {
          const existingBS = await BalanceSheet.list(null, 2000).catch(() => []);
          const clientBS = existingBS.filter(b => b.client_id === clientId && b.tax_year === year);
          if (clientBS.length === 0) {
            await BalanceSheet.create({
              client_name: clientName, client_id: clientId,
              tax_year: year, current_stage: 'closing_operations',
              target_date: `${parseInt(year) + 1}-05-31`,
              folder_link: '', notes: '',
            });
          }
        }

        // --- AccountReconciliation ---
        if (rule.target_entity === 'AccountReconciliation') {
          const clientAccounts = await ClientAccount.filter({ client_id: clientId }).catch(() => []);
          if (clientAccounts.length > 0) {
            const existingRecs = await AccountReconciliation.list(null, 2000).catch(() => []);
            const period = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
            for (const account of clientAccounts) {
              const exists = existingRecs.some(r => r.client_id === clientId && r.client_account_id === account.id && r.period === period);
              if (!exists) {
                await AccountReconciliation.create({
                  client_id: clientId, client_name: clientName,
                  client_account_id: account.id, account_name: account.account_name || account.bank_name || '',
                  period, reconciliation_type: 'bank_credit',
                  status: 'not_started', due_date: dueDateStr, notes: '',
                });
              }
            }
          }
        }

        // --- Task-based boards (monthly reports, tax reports, payroll) ---
        if (rule.target_entity?.startsWith('Task_') && rule.task_categories?.length > 0) {
          // Check both reporting month and deadline month for existing tasks
          const reportingStart = new Date(prevMonthYear, prevMonth, 1).toISOString().split('T')[0];
          const existingTasks = await Task.filter({
            due_date: { '>=': reportingStart, '<=': deadlineMonthEndStr },
          }).catch(() => []);
          const clientTasks = existingTasks.filter(t => t.client_id === clientId);

          // Due dates go in the DEADLINE month (current month)
          let taskDueDate = deadlineMonthEndStr;
          if (rule.due_day_of_month) {
            const dueDay = Math.min(rule.due_day_of_month, deadlineMonthEnd.getDate());
            taskDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay).toISOString().split('T')[0];
          }

          // Load per-service due dates
          let svcDueDates = null;
          try { svcDueDates = (await loadServiceDueDates()).dueDates; } catch { /* ignore */ }

          // Client payment method
          const clientPaymentMethod = clientData?.reporting_info?.payment_method || 'digital';
          const masavSupplierCycles = clientData?.reporting_info?.masav_supplier_cycles || 1;

          for (const category of rule.task_categories) {
            // Per-category service check: skip if client doesn't have this category's service
            if (!clientHasServiceForCategory(category, rule.target_entity, services)) continue;

            // Per-category due date in DEADLINE month
            const catDueDay = getDueDayForCategory(svcDueDates, category, clientPaymentMethod);
            let catTaskDueDate = taskDueDate;
            if (catDueDay) {
              const dueDay = Math.min(catDueDay, deadlineMonthEnd.getDate());
              catTaskDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay).toISOString().split('T')[0];
            }

            // Handle masav supplier cycles
            const cycleCount = (category === 'מס"ב ספקים') ? masavSupplierCycles : 1;
            for (let cycle = 1; cycle <= cycleCount; cycle++) {
              const cycleSuffix = cycleCount > 1 ? ` (סייקל ${cycle})` : '';
              const existingForCycle = clientTasks.filter(t => t.category === category && t.status !== 'not_relevant');
              if (existingForCycle.length >= cycle) continue;

              await Task.create({
                title: `${category}${cycleSuffix} - ${clientName} - ${monthLabel}`,
                client_name: clientName,
                client_id: clientId,
                category: category,
                status: 'not_started',
                due_date: catTaskDueDate,
                reporting_month: reportingMonthStr,
                context: 'work',
                process_steps: {},
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ שגיאה ביצירת דיווחים אוטומטיים:', err.message);
    }
  };

  // ============================================================
  // Clean up tasks when reporting frequency changes
  // e.g., VAT monthly → bimonthly: mark odd-month tasks as not_relevant
  // ============================================================
  const FREQUENCY_VALID_MONTHS = {
    monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    bimonthly: [2, 4, 6, 8, 10, 12],
    quarterly: [3, 6, 9, 12],
    semi_annual: [6, 12],
    not_applicable: [],
  };

  const CATEGORY_FREQUENCY_FIELDS = {
    'מע"מ': 'vat_reporting_frequency',
    'מקדמות מס': 'tax_advances_frequency',
    'ניכויים': 'deductions_frequency',
    'ביטוח לאומי': 'social_security_frequency',
    'שכר': 'payroll_frequency',
  };

  const cleanupTasksForFrequencyChange = async (clientId, clientName, oldReportingInfo, newReportingInfo) => {
    try {
      // Detect which categories had frequency changes
      const changedCategories = [];
      for (const [category, freqField] of Object.entries(CATEGORY_FREQUENCY_FIELDS)) {
        const oldFreq = oldReportingInfo?.[freqField] || 'monthly';
        const newFreq = newReportingInfo?.[freqField] || 'monthly';
        if (oldFreq !== newFreq) {
          changedCategories.push({ category, oldFreq, newFreq });
        }
      }

      if (changedCategories.length === 0) return;

      // Load all tasks for this client
      const allTasks = await Task.list(null, 5000).catch(() => []);
      const clientTasks = allTasks.filter(t =>
        (t.client_id === clientId || t.client_name === clientName) &&
        (t.source === 'recurring_tasks' || t.is_recurring) &&
        t.status !== 'completed' &&
        t.status !== 'not_relevant'
      );

      let markedCount = 0;

      for (const { category, newFreq } of changedCategories) {
        const newValidMonths = FREQUENCY_VALID_MONTHS[newFreq] || [];

        // Find tasks for this category
        const categoryTasks = clientTasks.filter(t => t.category === category);

        for (const task of categoryTasks) {
          if (!task.due_date) continue;

          // Determine the report month from due_date
          // Due date is typically in the month AFTER the report month
          // Feb 19 (getMonth=1) → report month 1 (Jan)
          // Mar 19 (getMonth=2) → report month 2 (Feb)
          // Jan 19 (getMonth=0) → report month 12 (Dec, previous year)
          const dueDate = new Date(task.due_date);
          const reportMonth = dueDate.getMonth() === 0 ? 12 : dueDate.getMonth();

          // If the new frequency doesn't include this report month, mark as not_relevant
          if (newFreq === 'not_applicable' || !newValidMonths.includes(reportMonth)) {
            await Task.update(task.id, { status: 'not_relevant' });
            markedCount++;
          }
        }
      }

    } catch (err) {
      console.warn('⚠️ שגיאה בניקוי משימות ישנות:', err.message);
    }
  };

  // ============================================================
  // Clean up / create tasks when service types change
  // e.g., payroll removed → mark all payroll tasks as not_relevant
  //        payroll added → autoCreateReportsForClient handles creation
  // ============================================================

  // Map client service_types to processTemplate service keys
  const CLIENT_SERVICE_TO_TEMPLATE_KEY = {
    vat_reporting: 'vat',
    bookkeeping: 'bookkeeping',
    tax_advances: 'tax_advances',
    payroll: 'payroll',
    social_security: 'social_security',
    deductions: 'deductions',
    reconciliation: 'reconciliation',
    annual_reports: 'annual_reports',
    authorities_payment: 'authorities_payment',
    reserve_claims: 'reserve_claims',
    social_benefits: 'social_benefits',
    masav_employees: 'masav_employees',
    masav_social: 'masav_social',
    masav_suppliers: 'masav_suppliers',
    masav_authorities: 'masav_authorities',
    consulting: 'consulting',
    admin: 'admin',
    operator_reporting: 'operator_reporting',
    taml_reporting: 'taml_reporting',
    payslip_sending: 'payslip_sending',
  };

  const cleanupTasksForServiceChange = async (clientId, clientName, oldServiceTypes, newServiceTypes) => {
    try {
      const removed = (oldServiceTypes || []).filter(s => !(newServiceTypes || []).includes(s));
      if (removed.length === 0) return;

      // Collect all task categories for removed services
      const removedCategories = [];
      for (const svcType of removed) {
        const templateKey = CLIENT_SERVICE_TO_TEMPLATE_KEY[svcType];
        if (templateKey && ALL_SERVICES[templateKey]) {
          removedCategories.push(...ALL_SERVICES[templateKey].taskCategories);
        }
      }
      if (removedCategories.length === 0) return;

      // Load all tasks for this client
      const allTasks = await Task.list(null, 5000).catch(() => []);
      const clientTasks = allTasks.filter(t =>
        (t.client_id === clientId || t.client_name === clientName) &&
        t.status !== 'completed' &&
        t.status !== 'not_relevant'
      );

      let markedCount = 0;
      for (const task of clientTasks) {
        if (removedCategories.includes(task.category)) {
          await Task.update(task.id, { status: 'not_relevant' });
          markedCount++;
        }
      }

    } catch (err) {
      console.warn('⚠️ שגיאה בניקוי משימות עקב שינוי שירותים:', err.message);
    }
  };

  // Auto-create or update a Lead + marketing follow-up task for potential clients
  const autoCreateLeadForPotentialClient = async (clientData, isUpdate = false) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingLeads = await Lead.list(null, 500).catch(() => []);
      const existingLead = existingLeads.find(l =>
        l.company_name === clientData.name && l.status !== 'closed_lost'
      );

      if (existingLead) {
        // Update existing lead with latest client info
        await Lead.update(existingLead.id, {
          contact_person: clientData.contact_person || existingLead.contact_person,
          email: clientData.email || existingLead.email,
          phone: clientData.phone || existingLead.phone,
          quote_amount: parseFloat(clientData.monthly_fee) || existingLead.quote_amount,
          last_contact_date: today,
        });
        return;
      }

      // Create new lead
      await Lead.create({
        company_name: clientData.name,
        contact_person: clientData.contact_person || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        source: 'לקוח פוטנציאלי',
        status: 'new_lead',
        created_date: today,
        last_contact_date: today,
        quote_amount: parseFloat(clientData.monthly_fee) || null,
      });
      // Create marketing follow-up task
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await Task.create({
        title: `מעקב שיווק - ${clientData.name}`,
        client_name: clientData.name,
        category: 'מעקב שיווק',
        status: 'not_started',
        due_date: dueDate.toISOString().split('T')[0],
        context: 'work',
        notes: `לקוח פוטנציאלי חדש. שכ״ט צפוי: ₪${clientData.monthly_fee || 0}. ליצור קשר ולעקוב.`,
        process_steps: {},
      });
    } catch (err) {
      console.warn('⚠️ שגיאה ביצירת/עדכון ליד:', err.message);
    }
  };

  const handleSaveClient = async (clientData) => {
    const isNew = !selectedClient?.id;
    const wasPotential = selectedClient?.status === 'potential';
    const isPotentialNow = clientData.status === 'potential';
    setIsSaving(true);
    setError(null);

    try {
      let savedClientId = selectedClient?.id;
      await retryWithBackoff(async () => {
        if (isNew) {
          const onboarding_link_id = crypto.randomUUID();
          const created = await Client.create({ ...clientData, status: clientData.status || 'potential', onboarding_link_id });
          savedClientId = created.id;
        } else {
          await Client.update(selectedClient.id, clientData);
        }
      }, 3, 2000);

      // Auto-create reports in background for active clients with relevant services
      if (savedClientId && (clientData.status === 'active' || (!isNew && selectedClient?.status === 'active'))) {
        autoCreateReportsForClient(savedClientId, clientData.name, clientData);
      }

      // Auto-create or update lead for potential clients (including edits)
      if (isPotentialNow) {
        autoCreateLeadForPotentialClient(clientData, !isNew);
      }

      // Clean up tasks when reporting frequency changes (e.g., monthly → bimonthly)
      if (!isNew && selectedClient?.reporting_info) {
        cleanupTasksForFrequencyChange(savedClientId, clientData.name, selectedClient.reporting_info, clientData.reporting_info);
      }

      // Clean up tasks when services are removed (mark as not_relevant)
      if (!isNew && selectedClient?.service_types) {
        cleanupTasksForServiceChange(savedClientId, clientData.name, selectedClient.service_types, clientData.service_types);
      }

      // Monday push removed — DNA is sole source of truth

      setSelectedClient(null);
      setSelectedPanelClient(null);
      setPanelTab('details');
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
    const empty = { name: '', contacts: [], service_types: [], status: 'potential' };
    setSelectedClient(empty);
    openPanel(empty, 'details');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Debug section removed for production */}

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 border-2 border-emerald-200 shadow-md flex items-center justify-center overflow-hidden p-1.5">
            <img
              src="/logo-litay.png"
              alt="Litay LTD"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.parentElement.innerHTML = '<span class="text-2xl font-black text-emerald-600">L</span>'; }}
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              ניהול לקוחות ({filteredClients.length} מתוך {clients.length})
            </h1>
            <p className="text-sm text-gray-500">מערכת CRM מתקדמת לניהול לקוחות ותהליכים</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
          <Button onClick={loadClients} variant="outline" size="sm" disabled={isLoading || isSyncing}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 ms-2" />
                תבניות
                <ChevronDown className="w-4 h-4 me-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 ms-2" />
                תבנית חשבונות בנק
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                <Download className="w-4 h-4 ms-2" />
                ייצוא לקוחות
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCustomerServices} disabled={isExporting}>
                <Download className="w-4 h-4 ms-2" />
                ייצוא שירותי לקוחות (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isImporting}>
                <Upload className={`w-4 h-4 ms-2 ${isImporting ? 'animate-spin' : ''}`} />
                ייבוא
                <ChevronDown className="w-4 h-4 me-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <label htmlFor="import-accounts" className="cursor-pointer flex items-center w-full">
                  <Upload className="w-4 h-4 ms-2" />
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
                  <Upload className="w-4 h-4 ms-2" />
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
              {/* Monday import/sync removed — CalmPlan DNA is the source of truth */}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleAddNewClient} className="bg-primary hover:bg-accent text-white" disabled={isSaving}>
            <Plus className="w-4 h-4 ms-2" />
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
                  <RefreshCw className="w-4 h-4 ms-2" />
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

            <MultiStatusFilter
              options={[
                { value: 'active', label: 'פעיל', count: statusCounts.active },
                { value: 'inactive', label: 'לא פעיל', count: statusCounts.inactive },
                { value: 'potential', label: 'פוטנציאלי', count: statusCounts.potential },
                { value: 'former', label: 'עבר', count: statusCounts.former },
                { value: 'onboarding_pending', label: 'ממתין לקליטה', count: statusCounts.onboarding_pending },
                { value: 'balance_sheet_only', label: 'סגירת מאזן בלבד', count: statusCounts.balance_sheet_only },
              ]}
              selected={statusFilter}
              onChange={setStatusFilter}
            />

            <div className="flex gap-1 ms-2">
              <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setAllCardsOpen(true)}>פתח הכל</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setAllCardsOpen(false)}>סגור הכל</Button>
            </div>

            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value)} className="hidden md:flex">
              <ToggleGroupItem value="grid" aria-label="תצוגת רשת">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="תצוגת רשימה">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="workbook" aria-label="חוברת לקוחות">
                <BookOpen className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Auto-migration indicator */}
            {isMigratingDev && (
              <span className="text-sm text-purple-600 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 animate-pulse" />
                מעביר לקוחות פיתוח לפרויקטים...
              </span>
            )}

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
            <>
            {/* Collapse/Expand all buttons */}
            {groupedClients.length > 1 && (
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#455A64] h-7"
                  onClick={() => setCollapsedGroups(new Set(groupedClients.map(g => g.status)))}
                >
                  כווץ הכל
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#455A64] h-7"
                  onClick={() => setCollapsedGroups(new Set())}
                >
                  הרחב הכל
                </Button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {view === 'workbook' ? (
                <motion.div
                  key="workbook-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <React.Suspense fallback={<div className="text-center py-8 text-gray-400">טוען חוברת...</div>}>
                    <ClientWorkbookEmbed embedded />
                  </React.Suspense>
                </motion.div>
              ) : view === 'grid' ? (
                <motion.div
                  key="grid-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {groupedClients.map(group => {
                    const visibleCount = visibleCountByGroup[group.status] || CLIENTS_PAGE_SIZE;
                    const visibleClients = group.clients.slice(0, visibleCount);
                    const hiddenCount = group.clients.length - visibleClients.length;
                    return (
                      <div key={group.status}>
                        <button
                          onClick={() => toggleGroup(group.status)}
                          className="flex items-center gap-2 w-full text-end py-2 px-3 rounded-lg hover:bg-[#F5F5F5] transition-colors mb-2"
                        >
                          <ChevronDown className={`w-4 h-4 text-[#455A64] transition-transform ${collapsedGroups.has(group.status) ? '-rotate-90' : ''}`} />
                          <span className="text-sm font-semibold text-[#263238]">{group.label}</span>
                          <Badge variant="outline" className="text-[12px] px-1.5 py-0">{group.clients.length}</Badge>
                          {hiddenCount > 0 && (
                            <Badge className="text-[11px] px-1.5 py-0 bg-amber-100 text-amber-800 border border-amber-200">
                              מציג {visibleClients.length} מתוך {group.clients.length}
                            </Badge>
                          )}
                        </button>
                        {!collapsedGroups.has(group.status) && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                              {visibleClients.map(client => (
                                <ClientCard
                                  key={client.id}
                                  client={client}
                                  isSelected={selectedClientIds.has(client.id)}
                                  forceOpen={allCardsOpen}
                                  onToggleSelect={() => handleToggleSelectClient(client.id)}
                                  onEdit={(c) => { setSelectedClient(c); openPanel(c, 'details'); }}
                                  onSelectTasks={(c) => openPanel(c, 'tasks')}
                                  onSelectAccounts={(c) => openPanel(c, 'accounts')}
                                  onSelectCollections={setSelectedCollectionsClient}
                                  onSelectContracts={setSelectedContractsClient}
                                  onSelectFiles={(c) => openPanel(c, 'files')}
                                  onSelectProviders={(c) => openPanel(c, 'providers')}
                                  onDelete={() => handleDeleteClient(client.id)}
                                />
                              ))}
                            </div>
                            {hiddenCount > 0 && (
                              <div className="flex justify-center mt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => handleShowMoreInGroup(group.status)}
                                  className="text-sm border-[#4682B4] text-[#4682B4] hover:bg-[#4682B4]/5"
                                >
                                  הצג עוד {Math.min(CLIENTS_PAGE_SIZE, hiddenCount)} לקוחות ({hiddenCount} נותרו)
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {groupedClients.map(group => (
                    <Card key={group.status}>
                      <button
                        onClick={() => toggleGroup(group.status)}
                        className="flex items-center gap-2 w-full text-end py-2.5 px-4 hover:bg-[#F5F5F5] transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-[#455A64] transition-transform ${collapsedGroups.has(group.status) ? '-rotate-90' : ''}`} />
                        <span className="text-sm font-semibold text-[#263238]">{group.label}</span>
                        <Badge variant="outline" className="text-[12px] px-1.5 py-0">{group.clients.length}</Badge>
                      </button>
                      {!collapsedGroups.has(group.status) && (
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {group.clients.map(client => (
                              <ClientListItem
                                key={client.id}
                                client={client}
                                isSelected={selectedClientIds.has(client.id)}
                                onToggleSelect={() => handleToggleSelectClient(client.id)}
                                onEdit={(c) => { setSelectedClient(c); openPanel(c, 'details'); }}
                                onSelectTasks={(c) => openPanel(c, 'tasks')}
                                onSelectAccounts={(c) => openPanel(c, 'accounts')}
                                onSelectCollections={setSelectedCollectionsClient}
                                onSelectContracts={setSelectedContractsClient}
                                onSelectFiles={(c) => openPanel(c, 'files')}
                                onSelectProviders={(c) => openPanel(c, 'providers')}
                                onDelete={() => handleDeleteClient(client.id)}
                              />
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            </>
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
              <p className="text-gray-500 mb-4">התחל על ידי הוספת הלקוח הראשון שלך.</p>
              <Button onClick={handleAddNewClient} className="bg-primary hover:bg-accent text-white">
                <Plus className="w-4 h-4 ms-2" />
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
                  <RefreshCw className="w-4 h-4 ms-2 animate-spin" />
                  מעדכן...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 ms-2" />
                  עדכן סטטוס
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Client Detail Panel — 5 tabs ===== */}
      <Sheet open={!!selectedPanelClient} onOpenChange={(open) => { if (!open) closePanel(); }}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col overflow-hidden"
          style={{ width: '90vw', maxWidth: '1100px' }}
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b flex-shrink-0">
            <SheetTitle className="text-xl font-bold">
              {selectedPanelClient?.id ? selectedPanelClient.name : 'לקוח חדש'}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={panelTab} onValueChange={setPanelTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 pt-3 flex-shrink-0">
              <TabsList className="w-full flex gap-0.5 h-auto bg-gray-100 p-1 rounded-xl">
                <TabsTrigger value="details" className="flex-1 rounded-lg">פרטים</TabsTrigger>
                <TabsTrigger value="accounts" className="flex-1 rounded-lg" disabled={!selectedPanelClient?.id}>חשבונות</TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1 rounded-lg" disabled={!selectedPanelClient?.id}>משימות</TabsTrigger>
                <TabsTrigger value="files" className="flex-1 rounded-lg" disabled={!selectedPanelClient?.id}>קבצים</TabsTrigger>
                <TabsTrigger value="providers" className="flex-1 rounded-lg" disabled={!selectedPanelClient?.id}>ספקים</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto relative">
              <TabsContent value="details" className="p-5 m-0">
                {selectedPanelClient && (
                  <ClientForm
                    client={selectedPanelClient}
                    onSubmit={handleSaveClient}
                    onCancel={closePanel}
                    onClientUpdate={loadClients}
                  />
                )}
                {isSaving && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      <span className="font-medium">שומר...</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="accounts" className="p-5 m-0">
                {selectedPanelClient?.id && (
                  <ClientAccountsManager clientId={selectedPanelClient.id} clientName={selectedPanelClient.name} />
                )}
              </TabsContent>

              <TabsContent value="tasks" className="p-5 m-0">
                {selectedPanelClient?.id && (
                  <ClientTasksTab clientId={selectedPanelClient.id} clientName={selectedPanelClient.name} />
                )}
              </TabsContent>

              <TabsContent value="files" className="p-5 m-0">
                {selectedPanelClient?.id && (
                  <ClientFilesManager clientId={selectedPanelClient.id} clientName={selectedPanelClient.name} />
                )}
              </TabsContent>

              <TabsContent value="providers" className="p-5 m-0">
                {selectedPanelClient?.id && (
                  <ClientServiceProvidersTab clientId={selectedPanelClient.id} clientName={selectedPanelClient.name} />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
      {/* ===== End Client Detail Panel ===== */}

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

      {/* Monday Data Import Dialog — removed (Kill Monday directive) */}
    </div>
  );
}
