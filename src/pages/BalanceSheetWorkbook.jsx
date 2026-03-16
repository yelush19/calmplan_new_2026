import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BalanceSheet, BalanceSheetWorkbook as WorkbookEntity, Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRight, FileSpreadsheet, FileText, BookOpen, Plus, Save,
  Trash2, ChevronDown, ChevronUp, Paperclip, MessageSquare,
  CheckCircle, AlertCircle, Clock, Download, Upload
} from 'lucide-react';
import { createWorkbookFromTemplate } from '@/config/balanceWorkbookTemplates';
import WorksheetEditor from '@/components/balance/WorksheetEditor';

// ── סטטוס גליון ──
const STATUS_CONFIG = {
  draft: { label: 'טיוטה', color: 'bg-gray-200 text-gray-700', icon: Clock },
  in_review: { label: 'בבדיקה', color: 'bg-blue-200 text-blue-700', icon: AlertCircle },
  approved: { label: 'מאושר', color: 'bg-green-200 text-green-700', icon: CheckCircle },
  needs_fix: { label: 'דורש תיקון', color: 'bg-orange-200 text-orange-700', icon: AlertCircle },
};

// ── סוגי פריטים בסרגל צד ──
const SIDEBAR_SECTIONS = [
  { key: 'worksheets', label: 'גליונות עבודה', icon: FileSpreadsheet, color: 'text-green-700' },
  { key: 'appendices', label: 'נספחים', icon: Paperclip, color: 'text-blue-700' },
  { key: 'biaurim', label: 'ביאורים', icon: FileText, color: 'text-purple-700' },
];

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

  // ניווט פנימי: { section: 'worksheets'|'appendices'|'biaurim', index: number }
  const [activeItem, setActiveItem] = useState({ section: 'worksheets', index: 0 });

  // ── טעינת נתונים ──
  useEffect(() => {
    loadWorkbook();
  }, [balanceSheetId]);

  const loadWorkbook = async () => {
    setIsLoading(true);
    try {
      // טען את ה-BalanceSheet הקיים
      const allBalanceSheets = await BalanceSheet.list(null, 1000);
      const bs = allBalanceSheets.find(b => b.id === balanceSheetId);
      setBalanceSheet(bs || null);

      // חפש חוברת עבודה קיימת
      const allWorkbooks = await WorkbookEntity.list(null, 1000);
      const existing = allWorkbooks.find(
        w => w.balance_sheet_id === balanceSheetId
      );

      if (existing) {
        setWorkbook(existing);
      } else if (bs) {
        // צור חוברת חדשה מתבנית
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
      await WorkbookEntity.update(workbook.id, {
        worksheets: workbook.worksheets,
        appendices: workbook.appendices,
        notes_biaurim: workbook.notes_biaurim,
        adjustments: workbook.adjustments,
        total_assets: workbook.total_assets,
        total_liabilities: workbook.total_liabilities,
        equity: workbook.equity,
        net_income: workbook.net_income,
        status: workbook.status,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving workbook:', error);
    }
    setIsSaving(false);
  }, [workbook]);

  // ── עדכון גליון עבודה ──
  const updateWorksheet = useCallback((worksheetId, updates) => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const worksheets = prev.worksheets.map(ws =>
        ws.id === worksheetId ? { ...ws, ...updates } : ws
      );
      return { ...prev, worksheets };
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── עדכון נספח ──
  const updateAppendix = useCallback((appendixId, updates) => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const appendices = prev.appendices.map(app =>
        app.id === appendixId ? { ...app, ...updates } : app
      );
      return { ...prev, appendices };
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── עדכון ביאור ──
  const updateBiur = useCallback((biurId, updates) => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const notes_biaurim = prev.notes_biaurim.map(b =>
        b.id === biurId ? { ...b, ...updates } : b
      );
      return { ...prev, notes_biaurim };
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── הוספת פריט חדש ──
  const addWorksheet = useCallback(() => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const id = `ws_new_${Date.now().toString(36)}`;
      const newWs = {
        id,
        key: 'custom_' + id,
        title: 'גליון חדש',
        type: 'custom',
        account_code: '',
        columns: [
          { key: 'description', label: 'תיאור', type: 'text' },
          { key: 'debit', label: 'חובה', type: 'number' },
          { key: 'credit', label: 'זכות', type: 'number' },
        ],
        opening_balance: 0,
        closing_balance: 0,
        book_balance: 0,
        audit_balance: 0,
        difference: 0,
        rows: [],
        status: 'draft',
        reviewed_by: null,
        review_date: null,
        attachments: [],
        notes: '',
        sort_order: prev.worksheets.length,
      };
      return { ...prev, worksheets: [...prev.worksheets, newWs] };
    });
    setHasUnsavedChanges(true);
  }, []);

  const addAppendix = useCallback(() => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const id = `app_new_${Date.now().toString(36)}`;
      const nextCode = String.fromCharCode('א'.charCodeAt(0) + prev.appendices.length);
      const newApp = {
        id,
        code: nextCode,
        title: `נספח ${nextCode}' — חדש`,
        content_type: 'table',
        columns: [
          { key: 'item', label: 'פריט', type: 'text' },
          { key: 'amount', label: 'סכום', type: 'number' },
        ],
        rows: [],
        attachments: [],
        sort_order: prev.appendices.length,
      };
      return { ...prev, appendices: [...prev.appendices, newApp] };
    });
    setHasUnsavedChanges(true);
  }, []);

  const addBiur = useCallback(() => {
    setWorkbook(prev => {
      if (!prev) return prev;
      const id = `biur_new_${Date.now().toString(36)}`;
      const newBiur = {
        id,
        number: prev.notes_biaurim.length + 1,
        title: 'ביאור חדש',
        content: '',
        linked_worksheet_id: null,
        tables: [],
        prior_year_values: {},
        current_year_values: {},
        status: 'draft',
        sort_order: prev.notes_biaurim.length,
      };
      return { ...prev, notes_biaurim: [...prev.notes_biaurim, newBiur] };
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── מחיקת פריט ──
  const removeItem = useCallback((section, id) => {
    setWorkbook(prev => {
      if (!prev) return prev;
      if (section === 'worksheets') {
        return { ...prev, worksheets: prev.worksheets.filter(ws => ws.id !== id) };
      }
      if (section === 'appendices') {
        return { ...prev, appendices: prev.appendices.filter(app => app.id !== id) };
      }
      if (section === 'biaurim') {
        return { ...prev, notes_biaurim: prev.notes_biaurim.filter(b => b.id !== id) };
      }
      return prev;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ── פריט פעיל ──
  const activeData = useMemo(() => {
    if (!workbook) return null;
    const { section, index } = activeItem;
    if (section === 'worksheets') return workbook.worksheets[index] || null;
    if (section === 'appendices') return workbook.appendices[index] || null;
    if (section === 'biaurim') return workbook.notes_biaurim[index] || null;
    return null;
  }, [workbook, activeItem]);

  // ── Loading ──
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
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור למאזנים
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/BalanceSheets')}>
            <ArrowRight className="w-4 h-4 ml-1" />
            חזור למאזנים
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <BookOpen className="w-5 h-5 text-green-700" />
          <h1 className="text-lg font-bold">
            {workbook.client_name} — מאזן {workbook.tax_year}
          </h1>
          {balanceSheet && (
            <Badge className="text-xs bg-green-100 text-green-800">
              {balanceSheet.current_stage?.replace(/_/g, ' ')}
            </Badge>
          )}
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

      {/* ── Main Layout: Sidebar + Editor ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar (ניווט פנימי) ── */}
        <div className="w-64 border-l bg-gray-50 overflow-y-auto flex-shrink-0">
          {SIDEBAR_SECTIONS.map(section => {
            const items = section.key === 'worksheets' ? workbook.worksheets
              : section.key === 'appendices' ? workbook.appendices
              : workbook.notes_biaurim;
            const Icon = section.icon;

            return (
              <div key={section.key} className="border-b last:border-b-0">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${section.color}`} />
                    <span className="text-sm font-semibold">{section.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">{items.length}</span>
                </div>
                <div className="py-1">
                  {items.map((item, idx) => {
                    const isActive = activeItem.section === section.key && activeItem.index === idx;
                    const status = item.status ? STATUS_CONFIG[item.status] : null;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveItem({ section: section.key, index: idx })}
                        className={`w-full text-right px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                          isActive
                            ? 'bg-green-100 text-green-900 font-medium border-r-2 border-green-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {status && (
                          <div className={`w-2 h-2 rounded-full ${
                            item.status === 'approved' ? 'bg-green-500' :
                            item.status === 'in_review' ? 'bg-blue-500' :
                            item.status === 'needs_fix' ? 'bg-orange-500' :
                            'bg-gray-400'
                          }`} />
                        )}
                        <span className="truncate flex-1">
                          {section.key === 'biaurim' ? `${item.number}. ${item.title}` :
                           section.key === 'appendices' ? item.title :
                           item.title}
                        </span>
                        {item.attachments?.length > 0 && (
                          <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    if (section.key === 'worksheets') addWorksheet();
                    else if (section.key === 'appendices') addAppendix();
                    else addBiur();
                  }}
                  className="w-full text-right px-3 py-2 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  הוסף {section.label.replace('גליונות עבודה', 'גליון').replace('נספחים', 'נספח').replace('ביאורים', 'ביאור')}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Editor Area ── */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeData ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeData.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeItem.section === 'worksheets' && (
                  <WorksheetEditor
                    worksheet={activeData}
                    onUpdate={(updates) => updateWorksheet(activeData.id, updates)}
                    onRemove={() => {
                      removeItem('worksheets', activeData.id);
                      setActiveItem({ section: 'worksheets', index: 0 });
                    }}
                  />
                )}

                {activeItem.section === 'appendices' && (
                  <AppendixEditorInline
                    appendix={activeData}
                    onUpdate={(updates) => updateAppendix(activeData.id, updates)}
                    onRemove={() => {
                      removeItem('appendices', activeData.id);
                      setActiveItem({ section: 'appendices', index: 0 });
                    }}
                  />
                )}

                {activeItem.section === 'biaurim' && (
                  <BiurEditorInline
                    biur={activeData}
                    onUpdate={(updates) => updateBiur(activeData.id, updates)}
                    onRemove={() => {
                      removeItem('biaurim', activeData.id);
                      setActiveItem({ section: 'biaurim', index: 0 });
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <p>בחר גליון, נספח או ביאור מהתפריט</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Appendix Editor (MVP — טבלה פשוטה) ──
function AppendixEditorInline({ appendix, onUpdate, onRemove }) {
  const [editTitle, setEditTitle] = useState(appendix.title);

  useEffect(() => { setEditTitle(appendix.title); }, [appendix.id]);

  const addRow = () => {
    const newRow = {};
    (appendix.columns || []).forEach(col => { newRow[col.key] = col.type === 'number' ? 0 : ''; });
    onUpdate({ rows: [...(appendix.rows || []), newRow] });
  };

  const updateRow = (rowIdx, key, value) => {
    const rows = [...(appendix.rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], [key]: value };
    onUpdate({ rows });
  };

  const removeRow = (rowIdx) => {
    const rows = (appendix.rows || []).filter((_, i) => i !== rowIdx);
    onUpdate({ rows });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Paperclip className="w-5 h-5 text-blue-700" />
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => onUpdate({ title: editTitle })}
            className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* טבלה */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-gray-600 w-8">#</th>
              {(appendix.columns || []).map(col => (
                <th key={col.key} className="px-3 py-2 text-right font-medium text-gray-600">{col.label}</th>
              ))}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {(appendix.rows || []).map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1 text-gray-400 text-xs">{rowIdx + 1}</td>
                {(appendix.columns || []).map(col => (
                  <td key={col.key} className="px-1 py-1">
                    <Input
                      type={col.type === 'number' ? 'number' : 'text'}
                      value={row[col.key] ?? ''}
                      onChange={(e) => updateRow(rowIdx, col.key, col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                      className="h-8 text-sm border-transparent hover:border-gray-300 focus:border-green-500"
                      dir={col.type === 'number' ? 'ltr' : 'rtl'}
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(rowIdx)}>
                    <Trash2 className="w-3 h-3 text-gray-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

// ── Inline Biur Editor (MVP — textarea + title) ──
function BiurEditorInline({ biur, onUpdate, onRemove }) {
  const [editTitle, setEditTitle] = useState(biur.title);
  const [editContent, setEditContent] = useState(biur.content);

  useEffect(() => {
    setEditTitle(biur.title);
    setEditContent(biur.content);
  }, [biur.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-purple-700" />
          <span className="text-sm text-gray-500">ביאור {biur.number}</span>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => onUpdate({ title: editTitle })}
            className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${STATUS_CONFIG[biur.status]?.color || 'bg-gray-200'}`}>
            {STATUS_CONFIG[biur.status]?.label || 'טיוטה'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={() => onUpdate({ content: editContent })}
        placeholder="תוכן הביאור..."
        rows={12}
        className="text-sm leading-relaxed"
        dir="rtl"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onUpdate({ status: biur.status === 'draft' ? 'final' : 'draft' })}
        >
          {biur.status === 'final' ? 'החזר לטיוטה' : 'סמן כסופי'}
        </Button>
      </div>
    </div>
  );
}
