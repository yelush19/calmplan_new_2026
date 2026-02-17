import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BalanceSheet, Client, Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3, Plus, Filter, RefreshCw, CheckCircle, AlertCircle, Clock,
  FileText, Building2, Calendar, User, ExternalLink, FolderOpen, ChevronDown,
  ChevronUp, Pencil, Save, X, ListChecks, Wand2, Settings2, Trash2, Check
} from 'lucide-react';
import { generateProcessTasks } from '@/api/functions';
import { loadBalanceSheetTemplates, saveBalanceSheetTemplates, DEFAULT_STAGE_TEMPLATES } from '@/config/balanceSheetTemplates';

// שלבי תהליך מאזן
const WORKFLOW_STAGES = [
  { key: 'closing_operations', label: 'פעולות סגירה', color: 'bg-gray-200 text-gray-800' },
  { key: 'editing_for_audit', label: 'עריכה לביקורת', color: 'bg-blue-200 text-blue-800' },
  { key: 'sent_to_auditor', label: 'שליחה לרו״ח', color: 'bg-purple-200 text-purple-800' },
  { key: 'auditor_questions_1', label: 'שאלות רו״ח - סבב 1', color: 'bg-orange-200 text-orange-800' },
  { key: 'auditor_questions_2', label: 'שאלות רו״ח - סבב 2', color: 'bg-orange-300 text-orange-900' },
  { key: 'signed', label: 'חתימה', color: 'bg-green-200 text-green-800' },
];

const getStageIndex = (stageKey) => WORKFLOW_STAGES.findIndex(s => s.key === stageKey);
const getStageConfig = (stageKey) => WORKFLOW_STAGES.find(s => s.key === stageKey) || WORKFLOW_STAGES[0];

const WorkflowProgress = ({ currentStage }) => {
  const currentIdx = getStageIndex(currentStage);
  return (
    <div className="flex items-center gap-1 w-full">
      {WORKFLOW_STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={stage.key} className="flex-1 flex flex-col items-center" title={stage.label}>
            <div className={`h-2 w-full rounded-full transition-colors ${
              isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'
            }`} />
            <span className={`text-[10px] mt-1 text-center leading-tight ${
              isCurrent ? 'font-bold text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
            }`}>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const BalanceSheetCard = ({ balance, onUpdate, onStageChange, onGenerateFromTemplate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const stage = getStageConfig(balance.current_stage);
  const daysUntilTarget = balance.target_date
    ? Math.ceil((new Date(balance.target_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const startEdit = () => {
    setEditData({
      target_date: balance.target_date || '',
      folder_link: balance.folder_link || '',
      notes: balance.notes || '',
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    onUpdate(balance.id, editData);
    setIsEditing(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{balance.client_name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">שנת מס: {balance.tax_year}</Badge>
                <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={startEdit} className="h-8 w-8">
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col gap-3">
          {/* Workflow progress bar */}
          <WorkflowProgress currentStage={balance.current_stage || 'closing_operations'} />

          {/* Target date */}
          {balance.target_date && (
            <div className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
              daysUntilTarget < 0 ? 'bg-red-50 text-red-700' :
              daysUntilTarget <= 7 ? 'bg-yellow-50 text-yellow-700' :
              'bg-green-50 text-green-700'
            }`}>
              <Calendar className="w-4 h-4" />
              <span>יעד: {new Date(balance.target_date).toLocaleDateString('he-IL')}</span>
              <span className="mr-auto font-semibold">
                {daysUntilTarget < 0 ? `באיחור ${Math.abs(daysUntilTarget)} ימים` :
                 daysUntilTarget === 0 ? 'היום!' :
                 `עוד ${daysUntilTarget} ימים`}
              </span>
            </div>
          )}

          {/* Folder link */}
          {balance.folder_link && (
            <a href={balance.folder_link} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 text-sm text-blue-600 hover:underline p-2 bg-blue-50 rounded-lg">
              <FolderOpen className="w-4 h-4" />
              <span>תיקיית מאזן</span>
              <ExternalLink className="w-3 h-3 mr-auto" />
            </a>
          )}

          {balance.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">{balance.notes}</p>
          )}

          {/* Stage selector + generate from template */}
          <div className="mt-auto pt-2 space-y-2">
            <Select value={balance.current_stage || 'closing_operations'} onValueChange={(val) => onStageChange(balance.id, val)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="שלב נוכחי" />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => onGenerateFromTemplate(balance.id)}
            >
              <Wand2 className="w-3.5 h-3.5" />
              צור משימות מתבנית
            </Button>
          </div>

          {/* Edit form */}
          {isEditing && (
            <div className="border-t pt-3 space-y-3">
              <div>
                <Label className="text-xs">תאריך יעד להעברה לביקורת</Label>
                <Input type="date" value={editData.target_date} onChange={(e) => setEditData(p => ({ ...p, target_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">קישור לתיקייה (Dropbox / Drive)</Label>
                <Input value={editData.folder_link} onChange={(e) => setEditData(p => ({ ...p, folder_link: e.target.value }))} placeholder="https://..." dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">הערות</Label>
                <Input value={editData.notes} onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))} placeholder="הערות..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="w-3 h-3 ml-1" /> ביטול
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  <Save className="w-3 h-3 ml-1" /> שמור
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function BalanceSheetsPage() {
  const [balanceSheets, setBalanceSheets] = useState([]);
  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({ stage: 'all', client: 'all', year: String(new Date().getFullYear() - 1) });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear() - 1));

  // Template state
  const [templates, setTemplates] = useState(DEFAULT_STAGE_TEMPLATES);
  const [templateConfigId, setTemplateConfigId] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(null); // balance sheet id
  const [isGeneratingFromTemplate, setIsGeneratingFromTemplate] = useState(false);
  const [templateGenResult, setTemplateGenResult] = useState(null);

  useEffect(() => {
    loadData();
    loadBalanceSheetTemplates().then(({ templates: t, configId }) => {
      setTemplates(t);
      setTemplateConfigId(configId);
    });
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balancesData, clientsData] = await Promise.all([
        BalanceSheet.list(null, 1000).catch(() => []),
        Client.list(null, 500).catch(() => [])
      ]);
      setBalanceSheets(balancesData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  // לקוחות פעילים עם שירות מאזנים
  const balanceClients = useMemo(() =>
    clients.filter(c => c.status === 'active' && (c.service_types || []).includes('annual_reports')),
    [clients]
  );

  // לקוחות שעדיין אין להם מאזן לשנה הנבחרת
  const clientsWithoutBalance = useMemo(() => {
    const existingClientNames = balanceSheets
      .filter(b => b.tax_year === selectedYear)
      .map(b => b.client_name);
    return balanceClients.filter(c => !existingClientNames.includes(c.name));
  }, [balanceClients, balanceSheets, selectedYear]);

  const handleStageChange = async (id, stage) => {
    try {
      await BalanceSheet.update(id, { current_stage: stage });
      loadData();
    } catch (error) {
      console.error("Error updating stage:", error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await BalanceSheet.update(id, data);
      loadData();
    } catch (error) {
      console.error("Error updating:", error);
    }
  };

  const handleCreateForClients = async () => {
    try {
      const defaultTargetDate = `${parseInt(selectedYear) + 1}-05-31`;
      for (const client of clientsWithoutBalance) {
        await BalanceSheet.create({
          client_name: client.name,
          client_id: client.id,
          tax_year: selectedYear,
          current_stage: 'closing_operations',
          target_date: defaultTargetDate,
          folder_link: '',
          notes: '',
        });
      }
      setShowCreatePanel(false);
      await loadData();
    } catch (error) {
      console.error("Error creating balance sheets:", error);
    }
  };

  const handleGenerateBalanceSheetTasks = async () => {
    setIsGeneratingTasks(true);
    setGenerationResult(null);
    try {
      const response = await generateProcessTasks({ taskType: 'balanceSheets' });
      if (response.data.success) {
        setGenerationResult({ type: 'success', message: response.data.message, details: response.data.results });
        loadData();
      } else {
        setGenerationResult({ type: 'error', message: response.data.message || 'שגיאה ביצירת משימות' });
      }
    } catch (error) {
      console.error("Error generating balance sheet tasks:", error);
      setGenerationResult({ type: 'error', message: 'שגיאה בקריאה לפונקציה' });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  // Generate tasks from template for a specific balance sheet
  const handleGenerateFromTemplate = async (balanceId) => {
    const balance = balanceSheets.find(b => b.id === balanceId);
    if (!balance) return;

    setIsGeneratingFromTemplate(true);
    setTemplateGenResult(null);

    try {
      // Load existing tasks for this client + balance sheet year
      const allTasks = await Task.list(null, 5000).catch(() => []);
      const existingClientTasks = allTasks.filter(t =>
        (t.client_id === balance.client_id || t.client_name === balance.client_name) &&
        t.category === 'מאזן' &&
        t.title?.includes(balance.tax_year)
      );
      const existingTitles = new Set(existingClientTasks.map(t => t.title));

      let createdCount = 0;
      const targetDate = balance.target_date || `${parseInt(balance.tax_year) + 1}-05-31`;

      for (const [stageKey, stageTemplate] of Object.entries(templates)) {
        for (const taskTemplate of stageTemplate.tasks) {
          const taskTitle = `${taskTemplate.title} - ${balance.client_name} - ${balance.tax_year}`;

          if (existingTitles.has(taskTitle)) continue;

          await Task.create({
            title: taskTitle,
            client_name: balance.client_name,
            client_id: balance.client_id || '',
            category: 'מאזן',
            status: 'not_started',
            due_date: targetDate,
            context: 'work',
            notes: `${taskTemplate.description || ''}\nשלב: ${stageTemplate.label}`,
            process_steps: {},
            balance_stage: stageKey,
            balance_sheet_id: balanceId,
          });
          createdCount++;
        }
      }

      setTemplateGenResult({
        type: 'success',
        message: createdCount > 0
          ? `נוצרו ${createdCount} משימות עבור ${balance.client_name} - ${balance.tax_year}`
          : `כל המשימות כבר קיימות עבור ${balance.client_name}`,
      });
      setShowGenerateDialog(null);
    } catch (err) {
      console.error('Error generating from template:', err);
      setTemplateGenResult({ type: 'error', message: 'שגיאה ביצירת משימות מתבנית' });
    } finally {
      setIsGeneratingFromTemplate(false);
    }
  };

  // Save updated templates
  const handleSaveTemplates = async (updatedTemplates) => {
    try {
      const newId = await saveBalanceSheetTemplates(templateConfigId, updatedTemplates);
      setTemplates(updatedTemplates);
      if (newId) setTemplateConfigId(newId);
    } catch (err) {
      console.error('Error saving templates:', err);
    }
  };

  const filteredBalances = useMemo(() => {
    return balanceSheets.filter(balance =>
      (filters.stage === 'all' || balance.current_stage === filters.stage) &&
      (filters.client === 'all' || balance.client_name === filters.client) &&
      (filters.year === 'all' || balance.tax_year === filters.year)
    );
  }, [balanceSheets, filters]);

  const progress = filteredBalances.length > 0
    ? (filteredBalances.filter(b => b.current_stage === 'signed').length / filteredBalances.length) * 100
    : 0;

  const stageCounts = useMemo(() => {
    const counts = {};
    WORKFLOW_STAGES.forEach(s => { counts[s.key] = 0; });
    filteredBalances.forEach(b => {
      const key = b.current_stage || 'closing_operations';
      if (counts[key] !== undefined) counts[key]++;
    });
    return counts;
  }, [filteredBalances]);

  const availableYears = useMemo(() => {
    const years = [...new Set(balanceSheets.map(b => b.tax_year))].filter(Boolean);
    const currentYear = String(new Date().getFullYear() - 1);
    if (!years.includes(currentYear)) years.push(currentYear);
    return years.sort((a, b) => b.localeCompare(a));
  }, [balanceSheets]);

  const overdueCount = filteredBalances.filter(b =>
    b.target_date && new Date(b.target_date) < new Date() && b.current_stage !== 'signed'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-full">
            <BarChart3 className="w-8 h-8 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">מעקב מאזנים שנתיים</h1>
            <p className="text-sm text-gray-600">מעקב שלבי תהליך מאזן לכל לקוח</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowTemplateEditor(true)} className="flex items-center gap-1">
            <Settings2 className="w-4 h-4" />
            תבניות מאזן
          </Button>
          <Button variant="outline" onClick={() => setShowCreatePanel(!showCreatePanel)} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            צור מאזנים ללקוחות
          </Button>
          <Button variant="outline" onClick={handleGenerateBalanceSheetTasks} disabled={isGeneratingTasks}
            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
            <RefreshCw className={`w-4 h-4 ml-1 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
            {isGeneratingTasks ? 'יוצר...' : 'צור משימות'}
          </Button>
        </div>
      </div>

      {/* Create panel */}
      {showCreatePanel && (
        <Card className="border-2 border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Label>שנת מס:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...Array(5)].map((_, i) => {
                    const y = String(new Date().getFullYear() - 1 - i);
                    return <SelectItem key={y} value={y}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            {clientsWithoutBalance.length > 0 ? (
              <>
                <p className="text-sm">{clientsWithoutBalance.length} לקוחות עם שירות מאזנים שעדיין אין להם מאזן לשנת {selectedYear}:</p>
                <div className="flex flex-wrap gap-1">
                  {clientsWithoutBalance.map(c => (
                    <Badge key={c.id} variant="outline">{c.name}</Badge>
                  ))}
                </div>
                <Button onClick={handleCreateForClients}>
                  <Plus className="w-4 h-4 ml-1" />
                  צור מאזנים ל-{clientsWithoutBalance.length} לקוחות
                </Button>
              </>
            ) : (
              <p className="text-sm text-green-700">כל הלקוחות עם שירות מאזנים כבר יש להם מאזן לשנת {selectedYear}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task generation result */}
      {generationResult && (
        <div className={`p-4 rounded-lg border ${
          generationResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {generationResult.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{generationResult.message}</span>
            <Button variant="ghost" size="sm" onClick={() => setGenerationResult(null)} className="mr-auto">סגור</Button>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">סה״כ מאזנים</p>
            <p className="text-2xl font-bold">{filteredBalances.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">חתומים</p>
            <p className="text-2xl font-bold text-green-600">{stageCounts.signed || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">באיחור</p>
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">התקדמות</p>
            <div className="flex items-center gap-2 justify-center">
              <Progress value={progress} className="w-20 h-2" />
              <span className="text-sm font-semibold">{Math.round(progress)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage distribution */}
      <div className="flex flex-wrap gap-2">
        {WORKFLOW_STAGES.map(s => (
          <Badge key={s.key} className={`${s.color} cursor-pointer`}
            onClick={() => setFilters(f => ({ ...f, stage: f.stage === s.key ? 'all' : s.key }))}>
            {s.label}: {stageCounts[s.key] || 0}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <Select value={filters.year} onValueChange={(v) => setFilters(f => ({ ...f, year: v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="שנה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השנים</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.stage} onValueChange={(v) => setFilters(f => ({ ...f, stage: v }))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="שלב" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השלבים</SelectItem>
            {WORKFLOW_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.client} onValueChange={(v) => setFilters(f => ({ ...f, client: v }))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="לקוח" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {balanceClients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Template generation result */}
      {templateGenResult && (
        <div className={`p-4 rounded-lg border ${
          templateGenResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {templateGenResult.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{templateGenResult.message}</span>
            <Button variant="ghost" size="sm" onClick={() => setTemplateGenResult(null)} className="mr-auto">סגור</Button>
          </div>
        </div>
      )}

      {/* Balance Sheets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBalances.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">לא נמצאו מאזנים</p>
              <p className="text-gray-400 text-sm">לחצי על "צור מאזנים ללקוחות" כדי להתחיל</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredBalances.map(balance => (
                <BalanceSheetCard
                  key={balance.id}
                  balance={balance}
                  onStageChange={handleStageChange}
                  onUpdate={handleUpdate}
                  onGenerateFromTemplate={(id) => setShowGenerateDialog(id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Generate from template confirmation dialog */}
      <Dialog open={!!showGenerateDialog} onOpenChange={(open) => !open && setShowGenerateDialog(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>יצירת משימות מתבנית מאזן</DialogTitle>
            <DialogDescription>
              {showGenerateDialog && (() => {
                const b = balanceSheets.find(x => x.id === showGenerateDialog);
                return b ? `${b.client_name} - שנת מס ${b.tax_year}` : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">יווצרו המשימות הבאות מהתבנית (משימות קיימות לא יכפלו):</p>
            {Object.entries(templates).map(([stageKey, stageData]) => (
              <div key={stageKey} className="border rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-800 mb-2">{stageData.label}</h4>
                <div className="space-y-1">
                  {stageData.tasks.map(t => (
                    <div key={t.key} className="flex items-center gap-2 text-xs text-gray-600">
                      <ListChecks className="w-3 h-3 text-purple-500" />
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGenerateDialog(null)}>ביטול</Button>
              <Button
                onClick={() => handleGenerateFromTemplate(showGenerateDialog)}
                disabled={isGeneratingFromTemplate}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingFromTemplate ? (
                  <><RefreshCw className="w-4 h-4 ml-1 animate-spin" /> יוצר...</>
                ) : (
                  <><Wand2 className="w-4 h-4 ml-1" /> צור משימות</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template editor dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ניהול תבניות מאזן</DialogTitle>
            <DialogDescription>
              ערכי את המשימות הקבועות לכל שלב במאזן. משימות אלו ייווצרו אוטומטית עבור כל לקוח.
            </DialogDescription>
          </DialogHeader>
          <TemplateEditor
            templates={templates}
            onSave={(updated) => { handleSaveTemplates(updated); setShowTemplateEditor(false); }}
            onCancel={() => setShowTemplateEditor(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =====================================================
// TEMPLATE EDITOR COMPONENT
// =====================================================

function TemplateEditor({ templates, onSave, onCancel }) {
  const [editTemplates, setEditTemplates] = useState(() => JSON.parse(JSON.stringify(templates)));
  const [expandedStage, setExpandedStage] = useState(null);

  const handleAddTask = (stageKey) => {
    const updated = { ...editTemplates };
    updated[stageKey] = {
      ...updated[stageKey],
      tasks: [...updated[stageKey].tasks, { key: `custom_${Date.now()}`, title: '', description: '' }],
    };
    setEditTemplates(updated);
  };

  const handleRemoveTask = (stageKey, taskIdx) => {
    const updated = { ...editTemplates };
    updated[stageKey] = {
      ...updated[stageKey],
      tasks: updated[stageKey].tasks.filter((_, i) => i !== taskIdx),
    };
    setEditTemplates(updated);
  };

  const handleUpdateTask = (stageKey, taskIdx, field, value) => {
    const updated = { ...editTemplates };
    updated[stageKey] = {
      ...updated[stageKey],
      tasks: updated[stageKey].tasks.map((t, i) =>
        i === taskIdx ? { ...t, [field]: value } : t
      ),
    };
    setEditTemplates(updated);
  };

  const totalTasks = Object.values(editTemplates).reduce((sum, s) => sum + s.tasks.length, 0);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
        <span className="font-medium">{totalTasks}</span> משימות קבועות בסה"כ, ב-{Object.keys(editTemplates).length} שלבים.
        עריכת התבנית תשפיע על יצירות עתידיות בלבד.
      </div>

      {Object.entries(editTemplates).map(([stageKey, stageData]) => {
        const isExpanded = expandedStage === stageKey;
        return (
          <Card key={stageKey} className="border-gray-200">
            <button
              onClick={() => setExpandedStage(isExpanded ? null : stageKey)}
              className="w-full text-right px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">{stageData.label}</h3>
                <Badge variant="outline" className="text-xs">{stageData.tasks.length} משימות</Badge>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {stageData.tasks.map((task, idx) => (
                  <div key={task.key || idx} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={task.title}
                        onChange={(e) => handleUpdateTask(stageKey, idx, 'title', e.target.value)}
                        placeholder="שם המשימה"
                        className="text-sm h-8"
                      />
                      <Input
                        value={task.description || ''}
                        onChange={(e) => handleUpdateTask(stageKey, idx, 'description', e.target.value)}
                        placeholder="תיאור (אופציונלי)"
                        className="text-xs h-7 text-gray-500"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => handleRemoveTask(stageKey, idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1"
                  onClick={() => handleAddTask(stageKey)}
                >
                  <Plus className="w-3 h-3" /> הוסף משימה לשלב
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>ביטול</Button>
        <Button onClick={() => onSave(editTemplates)} className="bg-purple-600 hover:bg-purple-700">
          <Save className="w-4 h-4 ml-1" /> שמור תבניות
        </Button>
      </div>
    </div>
  );
}
