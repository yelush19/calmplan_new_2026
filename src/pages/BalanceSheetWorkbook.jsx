import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BalanceSheet, BalanceSheetWorkbook as WorkbookEntity, Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter
} from '@/components/ui/table';
import {
  ArrowRight, Save, Plus, ChevronDown, ChevronRight, Paperclip,
  FileSpreadsheet, FileText, Send, CheckSquare, Upload, X,
  BookOpen, Circle, Download
} from 'lucide-react';
import {
  createWorkbookFromTemplate,
  REFERENCE_STATUSES,
  WORKSHEET_TYPES,
  DEFAULT_ACCOUNT_GROUPS,
} from '@/config/balanceWorkbookTemplates';
import WorksheetEditor from '@/components/balance/WorksheetEditor';
import { exportToExcel, downloadCSV } from '@/engines/workbookExportEngine';

// ── סטטוס קבוצה ──
const GROUP_STATUSES = [
  { key: 'not_started', label: 'טרם התחיל', color: 'bg-gray-200 text-gray-700' },
  { key: 'in_progress', label: 'בעבודה', color: 'bg-yellow-200 text-yellow-800' },
  { key: 'done', label: 'הושלם', color: 'bg-green-200 text-green-800' },
];

function nextGroupStatus(current) {
  const order = ['not_started', 'in_progress', 'done'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

// ── פורמט מספרים ──
function formatNumber(val) {
  if (val == null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return num.toLocaleString('he-IL');
}

export default function BalanceSheetWorkbookPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const balanceSheetId = searchParams.get('balanceSheetId');
  const clientId = searchParams.get('clientId');
  const year = searchParams.get('year');

  const [workbook, setWorkbook] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('trial_balance');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // ── טעינת נתונים ──
  useEffect(() => {
    loadWorkbook();
  }, [balanceSheetId]);

  const loadWorkbook = async () => {
    setIsLoading(true);
    try {
      const allBalanceSheets = await BalanceSheet.list(null, 1000);
      const bs = allBalanceSheets.find(b => b.id === balanceSheetId);
      setBalanceSheet(bs || null);

      const allWorkbooks = await WorkbookEntity.list(null, 1000);
      const existing = allWorkbooks.find(w => w.balance_sheet_id === balanceSheetId);

      if (existing) {
        setWorkbook(existing);
      } else if (bs) {
        const newWorkbook = createWorkbookFromTemplate({
          clientId: bs.client_id,
          clientName: bs.client_name,
          taxYear: bs.tax_year,
          balanceSheetId: bs.id,
        });
        const created = await WorkbookEntity.create(newWorkbook);
        setWorkbook(created);
      }
    } catch (error) {
      console.error('Error loading workbook:', error);
    }
    setIsLoading(false);
  };

  // ── שמירה ──
  const saveWorkbook = useCallback(async () => {
    if (!workbook?.id) return;
    setIsSaving(true);
    try {
      const { id, created_date, updated_date, ...data } = workbook;
      await WorkbookEntity.update(workbook.id, data);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving workbook:', error);
    }
    setIsSaving(false);
  }, [workbook]);

  // ── עדכון כללי לחוברת ──
  const updateWorkbook = useCallback((updater) => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ──────────────────────────────────────────
  // Trial Balance helpers
  // ──────────────────────────────────────────

  const toggleGroupCollapse = useCallback((groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const toggleGroupStatus = useCallback((groupId) => {
    updateWorkbook(prev => ({
      ...prev,
      trial_balance: {
        ...prev.trial_balance,
        groups: prev.trial_balance.groups.map(g =>
          g.id === groupId ? { ...g, status: nextGroupStatus(g.status) } : g
        ),
      },
    }));
  }, [updateWorkbook]);

  // Expose import function for TrialBalanceTab's inline import button
  useEffect(() => {
    window.__importAccounts = (groupedAccounts) => {
      updateWorkbook(prev => {
        const groups = [...(prev.trial_balance?.groups || [])];
        for (const [groupKey, accounts] of Object.entries(groupedAccounts)) {
          const groupIdx = groups.findIndex(g => g.key === groupKey);
          if (groupIdx >= 0) {
            groups[groupIdx] = { ...groups[groupIdx], accounts: [...(groups[groupIdx].accounts || []), ...accounts] };
          } else {
            groups.push({ id: `grp_imp_${groupKey}`, key: groupKey, label: groupKey, group_code: '', accounts, status: 'not_started', sort_order: groups.length });
          }
        }
        return { ...prev, trial_balance: { ...prev.trial_balance, groups } };
      });
    };
    return () => { delete window.__importAccounts; };
  }, [updateWorkbook]);

  const addAccountToGroup = useCallback((groupId) => {
    updateWorkbook(prev => ({
      ...prev,
      trial_balance: {
        ...prev.trial_balance,
        groups: prev.trial_balance.groups.map(g => {
          if (g.id !== groupId) return g;
          const newAccount = {
            id: `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            account_code: '',
            account_name: '',
            debit: 0,
            credit: 0,
            difference: 0,
            reference_status: 'not_started',
            reference_note: '',
          };
          return { ...g, accounts: [...g.accounts, newAccount] };
        }),
      },
    }));
  }, [updateWorkbook]);

  const updateAccount = useCallback((groupId, accountId, field, value) => {
    updateWorkbook(prev => ({
      ...prev,
      trial_balance: {
        ...prev.trial_balance,
        groups: prev.trial_balance.groups.map(g => {
          if (g.id !== groupId) return g;
          const accounts = g.accounts.map(acc => {
            if (acc.id !== accountId) return acc;
            const updated = { ...acc, [field]: value };
            // חישוב הפרש אוטומטי
            if (field === 'debit' || field === 'credit') {
              updated.difference = (parseFloat(updated.debit) || 0) - (parseFloat(updated.credit) || 0);
            }
            return updated;
          });
          // חישוב סיכום קבוצה
          const summary = {
            debit: accounts.reduce((s, a) => s + (parseFloat(a.debit) || 0), 0),
            credit: accounts.reduce((s, a) => s + (parseFloat(a.credit) || 0), 0),
            difference: accounts.reduce((s, a) => s + (parseFloat(a.difference) || 0), 0),
          };
          return { ...g, accounts, summary };
        }),
      },
    }));
  }, [updateWorkbook]);

  const removeAccount = useCallback((groupId, accountId) => {
    updateWorkbook(prev => ({
      ...prev,
      trial_balance: {
        ...prev.trial_balance,
        groups: prev.trial_balance.groups.map(g => {
          if (g.id !== groupId) return g;
          const accounts = g.accounts.filter(a => a.id !== accountId);
          const summary = {
            debit: accounts.reduce((s, a) => s + (parseFloat(a.debit) || 0), 0),
            credit: accounts.reduce((s, a) => s + (parseFloat(a.credit) || 0), 0),
            difference: accounts.reduce((s, a) => s + (parseFloat(a.difference) || 0), 0),
          };
          return { ...g, accounts, summary };
        }),
      },
    }));
  }, [updateWorkbook]);

  // ──────────────────────────────────────────
  // Worksheet helpers
  // ──────────────────────────────────────────

  const updateWorksheet = useCallback((worksheetId, updates) => {
    updateWorkbook(prev => ({
      ...prev,
      worksheets: prev.worksheets.map(ws =>
        ws.id === worksheetId ? { ...ws, ...updates } : ws
      ),
    }));
  }, [updateWorkbook]);

  const addCustomWorksheet = useCallback(() => {
    const id = `ws_custom_${Date.now().toString(36)}`;
    updateWorkbook(prev => ({
      ...prev,
      worksheets: [
        ...prev.worksheets,
        {
          id,
          key: `custom_${id}`,
          label: 'גליון חדש',
          type: 'custom',
          linked_group: null,
          columns: [
            { key: 'description', label: 'תיאור', type: 'text' },
            { key: 'debit', label: 'חובה', type: 'number' },
            { key: 'credit', label: 'זכות', type: 'number' },
          ],
          rows: [],
          summary: {},
          attachments: [],
          notes: '',
          sort_order: prev.worksheets.length,
        },
      ],
    }));
    setActiveTab(id);
  }, [updateWorkbook]);

  const removeWorksheet = useCallback((worksheetId) => {
    updateWorkbook(prev => ({
      ...prev,
      worksheets: prev.worksheets.filter(ws => ws.id !== worksheetId),
    }));
    setActiveTab('trial_balance');
  }, [updateWorkbook]);

  // ──────────────────────────────────────────
  // PDF appendices helpers
  // ──────────────────────────────────────────

  const addPdfAppendix = useCallback(() => {
    const id = `pdf_${Date.now().toString(36)}`;
    updateWorkbook(prev => ({
      ...prev,
      pdf_appendices: [
        ...(prev.pdf_appendices || []),
        {
          id,
          name: 'מסמך חדש',
          section: 'כללי',
          uploaded_date: new Date().toISOString().slice(0, 10),
          file_url: null,
        },
      ],
    }));
  }, [updateWorkbook]);

  const removePdfAppendix = useCallback((appendixId) => {
    updateWorkbook(prev => ({
      ...prev,
      pdf_appendices: (prev.pdf_appendices || []).filter(p => p.id !== appendixId),
    }));
  }, [updateWorkbook]);

  const updatePdfAppendix = useCallback((appendixId, updates) => {
    updateWorkbook(prev => ({
      ...prev,
      pdf_appendices: (prev.pdf_appendices || []).map(p =>
        p.id === appendixId ? { ...p, ...updates } : p
      ),
    }));
  }, [updateWorkbook]);

  // ──────────────────────────────────────────
  // Output helpers
  // ──────────────────────────────────────────

  const toggleOutputPackageItem = useCallback((key) => {
    updateWorkbook(prev => ({
      ...prev,
      output: {
        ...prev.output,
        package: {
          ...prev.output.package,
          [key]: !prev.output.package[key],
        },
      },
    }));
  }, [updateWorkbook]);

  const addRound = useCallback((type) => {
    updateWorkbook(prev => ({
      ...prev,
      output: {
        ...prev.output,
        rounds: [
          ...(prev.output.rounds || []),
          {
            id: `round_${Date.now().toString(36)}`,
            date: new Date().toISOString().slice(0, 10),
            type,
            notes: '',
            attachments: [],
          },
        ],
      },
    }));
  }, [updateWorkbook]);

  const updateRoundNotes = useCallback((roundId, notes) => {
    updateWorkbook(prev => ({
      ...prev,
      output: {
        ...prev.output,
        rounds: (prev.output.rounds || []).map(r =>
          r.id === roundId ? { ...r, notes } : r
        ),
      },
    }));
  }, [updateWorkbook]);

  const sendToAuditor = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    // 1. Update workbook output status + add sent round
    updateWorkbook(prev => ({
      ...prev,
      output: {
        ...prev.output,
        status: 'sent',
        sent_date: today,
        rounds: [
          ...(prev.output.rounds || []),
          {
            id: `round_${Date.now().toString(36)}`,
            date: today,
            type: 'sent',
            notes: '',
            attachments: [],
          },
        ],
      },
    }));
    // 2. Advance balance sheet stage to sent_to_auditor
    if (balanceSheet?.id) {
      try {
        await BalanceSheet.update(balanceSheet.id, { current_stage: 'sent_to_auditor' });
        setBalanceSheet(prev => prev ? { ...prev, current_stage: 'sent_to_auditor' } : prev);
      } catch (err) {
        console.error('Error updating balance sheet stage:', err);
      }
    }
  }, [updateWorkbook, balanceSheet]);

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  if (!workbook) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-lg text-gray-600">לא נמצאה חוברת עבודה</p>
        <Button variant="outline" onClick={() => navigate('/BalanceSheets')}>
          <ArrowRight className="w-4 h-4 ms-2" />
          חזור למאזנים
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between p-3 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/BalanceSheets')}>
            <ArrowRight className="w-4 h-4 ms-1" />
            חזור
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <BookOpen className="w-5 h-5 text-green-700" />
          <h1 className="text-lg font-bold">
            {workbook.client_name} — מאזן {workbook.tax_year}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              שינויים לא שמורים
            </Badge>
          )}
          <Button
            size="sm"
            onClick={saveWorkbook}
            disabled={isSaving || !hasUnsavedChanges}
            className="gap-1 bg-green-700 hover:bg-green-800"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
        </div>
      </div>

      {/* ═══ Tab bar + Content ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        {/* Tab strip — styled like Excel bottom tabs */}
        <div className="bg-gray-100 border-b px-2 py-1 flex items-center gap-1 overflow-x-auto flex-shrink-0">
          <TabsList className="bg-transparent border-none rounded-none p-0 h-auto gap-0 flex-wrap">
            {/* Fixed: Trial Balance */}
            <TabsTrigger
              value="trial_balance"
              className="rounded-t-md rounded-b-none border border-b-0 border-gray-300 px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-green-800 data-[state=active]:border-b-white data-[state=active]:shadow-none bg-gray-200 text-gray-600"
            >
              <FileSpreadsheet className="w-4 h-4 ms-1" />
              בוחן והפניות
            </TabsTrigger>

            {/* Dynamic: Worksheets */}
            {(workbook.worksheets || []).map(ws => (
              <TabsTrigger
                key={ws.id}
                value={ws.id}
                className="rounded-t-md rounded-b-none border border-b-0 border-gray-300 px-3 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-blue-800 data-[state=active]:border-b-white data-[state=active]:shadow-none bg-gray-200 text-gray-600"
              >
                {ws.label}
              </TabsTrigger>
            ))}

            {/* Fixed: PDF */}
            <TabsTrigger
              value="pdf_appendices"
              className="rounded-t-md rounded-b-none border border-b-0 border-gray-300 px-3 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-800 data-[state=active]:border-b-white data-[state=active]:shadow-none bg-gray-200 text-gray-600"
            >
              <FileText className="w-4 h-4 ms-1" />
              נספחי PDF
            </TabsTrigger>

            {/* Fixed: Output */}
            <TabsTrigger
              value="output"
              className="rounded-t-md rounded-b-none border border-b-0 border-gray-300 px-3 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-orange-800 data-[state=active]:border-b-white data-[state=active]:shadow-none bg-gray-200 text-gray-600"
            >
              <Send className="w-4 h-4 ms-1" />
              פלט לשליחה
            </TabsTrigger>
          </TabsList>

          {/* Add worksheet button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={addCustomWorksheet}
            className="h-7 w-7 p-0 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 flex-shrink-0"
            title="הוסף גליון עבודה"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* ═══ Tab Content Area ═══ */}
        <div className="flex-1 overflow-y-auto bg-white">

          {/* ────── Trial Balance Tab ────── */}
          <TabsContent value="trial_balance" className="m-0 p-4">
            <TrialBalanceTab
              groups={workbook.trial_balance?.groups || []}
              collapsedGroups={collapsedGroups}
              onToggleCollapse={toggleGroupCollapse}
              onToggleStatus={toggleGroupStatus}
              onAddAccount={addAccountToGroup}
              onUpdateAccount={updateAccount}
              onRemoveAccount={removeAccount}
            />
          </TabsContent>

          {/* ────── Worksheet Tabs ────── */}
          {(workbook.worksheets || []).map(ws => (
            <TabsContent key={ws.id} value={ws.id} className="m-0 p-4">
              <WorksheetEditor
                worksheet={ws}
                onUpdate={(updates) => updateWorksheet(ws.id, updates)}
                onRemove={() => removeWorksheet(ws.id)}
              />
            </TabsContent>
          ))}

          {/* ────── PDF Appendices Tab ────── */}
          <TabsContent value="pdf_appendices" className="m-0 p-4">
            <PdfAppendicesTab
              appendices={workbook.pdf_appendices || []}
              onAdd={addPdfAppendix}
              onRemove={removePdfAppendix}
              onUpdate={updatePdfAppendix}
            />
          </TabsContent>

          {/* ────── Output Tab ────── */}
          <TabsContent value="output" className="m-0 p-4">
            <OutputTab
              workbook={workbook}
              output={workbook.output || {}}
              onTogglePackageItem={toggleOutputPackageItem}
              onAddRound={addRound}
              onUpdateRoundNotes={updateRoundNotes}
              onSendToAuditor={sendToAuditor}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// Trial Balance Tab Component
// ══════════════════════════════════════════════════════════════

function TrialBalanceTab({
  groups,
  collapsedGroups,
  onToggleCollapse,
  onToggleStatus,
  onAddAccount,
  onUpdateAccount,
  onRemoveAccount,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">מאזן בוחן והפניות</h2>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="import-excel-trial"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { parseHashavshevetExcel } = await import('@/engines/excelImportEngine');
                const result = await parseHashavshevetExcel(file);
                if (!result.success) { alert('שגיאה:\n' + result.errors.join('\n')); return; }
                const summary = Object.entries(result.groupSummary).map(([k, v]) => `${v.label}: ${v.count} חשבונות`).join('\n');
                if (!confirm(`נמצאו ${result.totalAccounts} חשבונות:\n\n${summary}\n\nלייבא?`)) return;
                // Call parent to merge accounts
                if (typeof window.__importAccounts === 'function') window.__importAccounts(result.groups);
                else alert('ייבוא לא זמין — נסי מכפתור בתחתית העמוד');
              } catch (err) { alert('שגיאה: ' + err.message); }
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => document.getElementById('import-excel-trial')?.click()}>
            📥 ייבוא מחשבשבת
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {GROUP_STATUSES.map(s => (
            <span key={s.key} className="flex items-center gap-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.color.split(' ')[0]}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {groups.map(group => (
        <TrialBalanceGroup
          key={group.id}
          group={group}
          isCollapsed={!!collapsedGroups[group.id]}
          onToggleCollapse={() => onToggleCollapse(group.id)}
          onToggleStatus={() => onToggleStatus(group.id)}
          onAddAccount={() => onAddAccount(group.id)}
          onUpdateAccount={(accountId, field, value) => onUpdateAccount(group.id, accountId, field, value)}
          onRemoveAccount={(accountId) => onRemoveAccount(group.id, accountId)}
        />
      ))}
    </div>
  );
}


function TrialBalanceGroup({
  group,
  isCollapsed,
  onToggleCollapse,
  onToggleStatus,
  onAddAccount,
  onUpdateAccount,
  onRemoveAccount,
}) {
  const statusConfig = GROUP_STATUSES.find(s => s.key === group.status) || GROUP_STATUSES[0];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* ── Group Header (bold, colored) ── */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-700 text-white cursor-pointer select-none"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          {isCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
          <span className="font-bold text-sm">{group.group_code}</span>
          <span className="font-semibold text-sm">{group.label}</span>
          {group.accounts.length > 0 && (
            <span className="text-xs text-gray-300 me-2">({group.accounts.length} חשבונות)</span>
          )}
          {(group.attachments || []).length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-300">
              <Paperclip className="w-3 h-3" />
              {group.attachments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Badge
            className={`text-xs cursor-pointer select-none ${statusConfig.color}`}
            onClick={onToggleStatus}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* ── Account Rows ── */}
      {!isCollapsed && (
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-2 py-1.5 text-end font-medium w-24">חשבון</th>
                <th className="px-2 py-1.5 text-end font-medium">שם חשבון</th>
                <th className="px-2 py-1.5 text-start font-medium w-28">חובה</th>
                <th className="px-2 py-1.5 text-start font-medium w-28">זכות</th>
                <th className="px-2 py-1.5 text-start font-medium w-28">הפרש</th>
                <th className="px-2 py-1.5 text-end font-medium w-40">סטטוס הפניה</th>
                <th className="px-2 py-1.5 text-end font-medium w-48">הערת הפניה</th>
                <th className="px-2 py-1.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {group.accounts.map(acc => (
                <tr key={acc.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-1 py-0.5">
                    <Input
                      value={acc.account_code}
                      onChange={e => onUpdateAccount(acc.id, 'account_code', e.target.value)}
                      className="h-7 text-sm border-transparent hover:border-gray-300 focus:border-green-500"
                      placeholder="קוד"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input
                      value={acc.account_name}
                      onChange={e => onUpdateAccount(acc.id, 'account_name', e.target.value)}
                      className="h-7 text-sm border-transparent hover:border-gray-300 focus:border-green-500"
                      placeholder="שם חשבון"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input
                      type="number"
                      value={acc.debit || ''}
                      onChange={e => onUpdateAccount(acc.id, 'debit', parseFloat(e.target.value) || 0)}
                      className="h-7 text-sm border-transparent hover:border-gray-300 focus:border-green-500 text-start"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <Input
                      type="number"
                      value={acc.credit || ''}
                      onChange={e => onUpdateAccount(acc.id, 'credit', parseFloat(e.target.value) || 0)}
                      className="h-7 text-sm border-transparent hover:border-gray-300 focus:border-green-500 text-start"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <span className={`block text-start text-sm px-2 py-1 ${
                      acc.difference > 0 ? 'text-red-600' : acc.difference < 0 ? 'text-blue-600' : 'text-gray-400'
                    }`} dir="ltr">
                      {formatNumber(acc.difference)}
                    </span>
                  </td>
                  <td className="px-1 py-0.5">
                    <select
                      value={acc.reference_status || 'not_started'}
                      onChange={e => onUpdateAccount(acc.id, 'reference_status', e.target.value)}
                      className="h-7 text-xs rounded border border-transparent hover:border-gray-300 focus:border-green-500 bg-transparent w-full cursor-pointer"
                      style={{
                        backgroundColor: (REFERENCE_STATUSES.find(s => s.key === acc.reference_status) || {}).color || '#d1d5db',
                        color: '#1f2937',
                      }}
                    >
                      {REFERENCE_STATUSES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-0.5">
                    <Input
                      value={acc.reference_note || ''}
                      onChange={e => onUpdateAccount(acc.id, 'reference_note', e.target.value)}
                      className="h-7 text-sm border-transparent hover:border-gray-300 focus:border-green-500"
                      placeholder="הפניה..."
                    />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveAccount(acc.id)}
                    >
                      <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Summary Row (cyan/blue bg) ── */}
          <div className="flex items-center bg-cyan-50 border-t border-cyan-200 px-2 py-1.5 text-sm font-semibold">
            <span className="w-24 px-2" />
            <span className="flex-1 px-2 text-cyan-800">סה"כ {group.label}</span>
            <span className="w-28 text-start px-2 text-cyan-900" dir="ltr">{formatNumber(group.summary?.debit)}</span>
            <span className="w-28 text-start px-2 text-cyan-900" dir="ltr">{formatNumber(group.summary?.credit)}</span>
            <span className="w-28 text-start px-2 text-cyan-900" dir="ltr">{formatNumber(group.summary?.difference)}</span>
            <span className="w-40 px-2" />
            <span className="w-48 px-2" />
            <span className="w-10" />
          </div>

          {/* ── Add row button ── */}
          <div className="px-3 py-1 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddAccount}
              className="text-xs text-green-700 hover:text-green-900 gap-1"
            >
              <Plus className="w-3 h-3" />
              הוסף חשבון
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// PDF Appendices Tab Component
// ══════════════════════════════════════════════════════════════

function PdfAppendicesTab({ appendices, onAdd, onRemove, onUpdate }) {
  // קיבוץ לפי section
  const grouped = useMemo(() => {
    const map = {};
    appendices.forEach(a => {
      const section = a.section || 'כללי';
      if (!map[section]) map[section] = [];
      map[section].push(a);
    });
    return map;
  }, [appendices]);

  const sections = Object.keys(grouped);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">נספחי PDF</h2>
        <Button size="sm" onClick={onAdd} className="gap-1 bg-purple-700 hover:bg-purple-800">
          <Upload className="w-4 h-4" />
          העלה מסמך
        </Button>
      </div>

      {appendices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed rounded-lg">
          <FileText className="w-10 h-10 mb-2" />
          <p>אין נספחים עדיין</p>
          <p className="text-sm">לחץ "העלה מסמך" להוספת קבצים</p>
        </div>
      ) : (
        sections.map(section => (
          <div key={section} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">{section}</h3>
            {grouped[section].map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <div>
                    <Input
                      value={doc.name}
                      onChange={e => onUpdate(doc.id, { name: e.target.value })}
                      className="h-7 text-sm font-medium border-transparent hover:border-gray-300 focus:border-purple-500 p-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={doc.section || 'כללי'}
                    onChange={e => onUpdate(doc.id, { section: e.target.value })}
                    className="h-7 text-xs rounded border border-gray-200 bg-white px-2"
                  >
                    <option value="כללי">כללי</option>
                    <option value="בנקים">בנקים</option>
                    <option value="לקוחות">לקוחות</option>
                    <option value="ספקים">ספקים</option>
                    <option value="רשויות">רשויות</option>
                    <option value="רכוש קבוע">רכוש קבוע</option>
                    <option value="שכר">שכר</option>
                    <option value="הון">הון</option>
                  </select>
                  <span className="text-xs text-gray-400">{doc.uploaded_date}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemove(doc.id)}
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// Output Tab Component
// ══════════════════════════════════════════════════════════════

const PACKAGE_LABELS = {
  trial_balance: 'מאזן בוחן סופי',
  financial_statements: 'דוחות כספיים (מאזן + רוו"ה)',
  tax_reconciliation: 'דוח התאמה למס',
  worksheets: 'גליונות עבודה',
  appendices: 'נספחים + קבצי PDF',
  adjustments_journal: 'פקודות יומן / תיקונים',
};

const ROUND_TYPE_LABELS = {
  sent: 'נשלח',
  questions: 'שאלות מרו"ח',
  answers: 'תשובות',
};

function OutputTab({ workbook, output, onTogglePackageItem, onAddRound, onUpdateRoundNotes, onSendToAuditor }) {
  const pkg = output.package || {};
  const rounds = output.rounds || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold text-gray-800">פלט לשליחה לרואה חשבון</h2>

      {/* Package checkboxes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">מה לכלול בחבילה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(PACKAGE_LABELS).map(key => (
            <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
              <input
                type="checkbox"
                checked={!!pkg[key]}
                onChange={() => onTogglePackageItem(key)}
                className="w-4 h-4 accent-green-700 rounded"
              />
              <span className="text-sm">{PACKAGE_LABELS[key]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Export buttons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">ייצוא חוברת עבודה</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            size="sm"
            className="gap-2 bg-green-700 hover:bg-green-800"
            onClick={() => exportToExcel(workbook)}
          >
            <Download className="w-4 h-4" />
            הורד אקסל (.xlsx)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => downloadCSV(workbook)}
          >
            <Download className="w-4 h-4" />
            הורד בוחן CSV
          </Button>
          <p className="text-xs text-gray-500 w-full mt-1">
            האקסל כולל: בוחן והפניות + כל גליונות העבודה + פקודות יומן.
            הרו"ח מקבל קובץ שהוא יכול לעבוד עליו.
          </p>
        </CardContent>
      </Card>

      {/* Import from Hashavshevet */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">📥 ייבוא בוחן מחשבשבת</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            העלי קובץ Excel עם בוחן מחשבשבת — המערכת תמפה אוטומטית חשבונות לקבוצות (בנקים, ספקים, רכוש...).
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            id="import-excel-input"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { parseHashavshevetExcel } = await import('@/engines/excelImportEngine');
                const result = await parseHashavshevetExcel(file);
                if (!result.success) {
                  alert('שגיאה בייבוא:\n' + result.errors.join('\n'));
                  return;
                }
                // Preview
                const summary = Object.entries(result.groupSummary)
                  .map(([k, v]) => `${v.label}: ${v.count} חשבונות (חו: ${v.totalDebit.toLocaleString()}, זכ: ${v.totalCredit.toLocaleString()})`)
                  .join('\n');
                if (!confirm(`נמצאו ${result.totalAccounts} חשבונות:\n\n${summary}\n\nלייבא לחוברת העבודה?`)) return;

                // Import: add accounts to matching groups
                const updatedWorkbook = { ...workbook };
                const groups = [...(updatedWorkbook.account_groups || [])];
                for (const [groupKey, accounts] of Object.entries(result.groups)) {
                  const groupIdx = groups.findIndex(g => g.key === groupKey);
                  if (groupIdx >= 0) {
                    groups[groupIdx] = {
                      ...groups[groupIdx],
                      accounts: [...(groups[groupIdx].accounts || []), ...accounts],
                    };
                  } else {
                    // Create new group for unmapped accounts
                    groups.push({
                      id: `grp_imp_${groupKey}`,
                      key: groupKey,
                      label: result.groupSummary[groupKey]?.label || groupKey,
                      group_code: '',
                      accounts,
                      status: 'not_started',
                      sort_order: groups.length,
                    });
                  }
                }
                setWorkbook(prev => ({ ...prev, account_groups: groups }));
                // Auto-save
                setTimeout(() => saveWorkbook(), 500);
                alert(`✅ יובאו ${result.totalAccounts} חשבונות בהצלחה!`);
              } catch (err) {
                alert('שגיאה: ' + err.message);
              }
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => document.getElementById('import-excel-input')?.click()}
          >
            <Upload className="w-4 h-4" />
            העלה קובץ Excel מחשבשבת
          </Button>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">סטטוס שליחה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Badge className={`text-xs ${
              output.status === 'sent' ? 'bg-green-200 text-green-800' :
              output.status === 'ready' ? 'bg-blue-200 text-blue-800' :
              'bg-gray-200 text-gray-700'
            }`}>
              {output.status === 'sent' ? 'נשלח' : output.status === 'ready' ? 'מוכן לשליחה' : 'לא מוכן'}
            </Badge>
            {output.sent_date && (
              <span className="text-xs text-gray-500">נשלח ב-{output.sent_date}</span>
            )}
          </div>

          <Button
            size="sm"
            className="gap-1 bg-orange-600 hover:bg-orange-700"
            onClick={onSendToAuditor}
            disabled={output.status === 'sent'}
          >
            <Send className="w-4 h-4" />
            {output.status === 'sent' ? 'נשלח לרו"ח' : 'שלח לרו"ח'}
          </Button>
        </CardContent>
      </Card>

      {/* Rounds tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">מעקב סבבים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rounds.length === 0 ? (
            <p className="text-sm text-gray-400">טרם נשלח</p>
          ) : (
            rounds.map((round, idx) => (
              <div key={round.id || idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${
                      round.type === 'sent' ? 'bg-blue-100 text-blue-800' :
                      round.type === 'questions' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {ROUND_TYPE_LABELS[round.type] || round.type}
                    </Badge>
                    <span className="text-xs text-gray-500">{round.date}</span>
                  </div>
                  <span className="text-xs text-gray-400">סבב {idx + 1}</span>
                </div>
                <Textarea
                  value={round.notes || ''}
                  onChange={e => onUpdateRoundNotes(round.id, e.target.value)}
                  placeholder="הערות..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => onAddRound('sent')}>
              <Send className="w-3 h-3" />
              סבב שליחה
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => onAddRound('questions')}>
              שאלות מרו"ח
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => onAddRound('answers')}>
              תשובות
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
