import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  FileSpreadsheet, Plus, Trash2, Paperclip, PlayCircle, CheckCircle2,
} from 'lucide-react';

// ── סטטוסים ──
const STATUS_OPTIONS = [
  { key: 'not_started', label: 'טרם התחיל', color: 'bg-gray-200 text-gray-700', badgeVariant: 'secondary' },
  { key: 'in_progress', label: 'בעבודה', color: 'bg-blue-200 text-blue-700', badgeVariant: 'default' },
  { key: 'done', label: 'הושלם', color: 'bg-green-200 text-green-700', badgeVariant: 'default' },
];

// ── פורמט מספרים ──
const numberFormatter = new Intl.NumberFormat('he-IL');
function formatNumber(num) {
  if (num == null || isNaN(num)) return '—';
  return numberFormatter.format(num);
}

// ══════════════════════════════════════════════════════════════
// WorksheetEditor — עורך גליון עבודה
// ══════════════════════════════════════════════════════════════
export default function WorksheetEditor({ worksheet, onUpdate, onRemove, onRunReconciliation }) {
  const [editTitle, setEditTitle] = useState(worksheet.label || '');
  const [editNotes, setEditNotes] = useState(worksheet.notes || '');

  // Reset local state when switching worksheets
  useEffect(() => {
    setEditTitle(worksheet.label || '');
    setEditNotes(worksheet.notes || '');
  }, [worksheet.id]);

  // ── Column totals (auto-calculated) ──
  const columnTotals = useMemo(() => {
    const rows = worksheet.rows || [];
    const totals = {};
    (worksheet.columns || []).forEach(col => {
      if (col.type === 'number') {
        totals[col.key] = rows.reduce((sum, r) => sum + (parseFloat(r[col.key]) || 0), 0);
      }
    });
    return totals;
  }, [worksheet.rows, worksheet.columns]);

  // ── Summary bar values (type-dependent, auto-calculated) ──
  const summaryItems = useMemo(() => {
    const rows = worksheet.rows || [];
    const t = columnTotals;

    switch (worksheet.type) {
      case 'bank_reconciliation': {
        const bookBalance = (t.debit || 0) - (t.credit || 0);
        const bankBalance = parseFloat(worksheet.summary?.bank_statement_balance) || 0;
        return [
          { label: 'יתרה בהנה"ח', value: bookBalance, auto: true },
          { label: 'יתרה בדף בנק', value: bankBalance, editable: true, summaryKey: 'bank_statement_balance' },
          { label: 'הפרש', value: bookBalance - bankBalance, auto: true, highlight: true },
        ];
      }
      case 'credit_card_detail': {
        const totalCharges = t.total || 0;
        const cardCount = new Set(rows.map(r => r.card_id).filter(Boolean)).size;
        return [
          { label: 'סה"כ חיובים', value: totalCharges, auto: true },
          { label: 'מספר כרטיסים', value: cardCount, auto: true, isCount: true },
        ];
      }
      case 'fixed_assets_schedule': {
        return [
          { label: 'עלות מקורית כוללת', value: t.original_cost || 0, auto: true },
          { label: 'פחת נצבר', value: t.accum_depreciation || 0, auto: true },
          { label: 'יתרה נטו', value: t.net_book_value || 0, auto: true, highlight: true },
        ];
      }
      case 'provisions_calc': {
        return [
          { label: 'סה"כ הפרשות', value: t.total || 0, auto: true },
        ];
      }
      case 'payroll_reconciliation': {
        const diff = (t.payroll_system || 0) - (t.form_126 || 0);
        return [
          { label: 'הפרש שכר מול 126', value: diff, auto: true, highlight: true },
        ];
      }
      default:
        return [];
    }
  }, [worksheet.type, worksheet.rows, worksheet.summary, columnTotals]);

  // ── Row operations ──
  const addRow = useCallback(() => {
    const newRow = {};
    (worksheet.columns || []).forEach(col => {
      newRow[col.key] = col.type === 'number' ? 0 : '';
    });
    onUpdate({ rows: [...(worksheet.rows || []), newRow] });
  }, [worksheet.columns, worksheet.rows, onUpdate]);

  const updateRow = useCallback((rowIdx, key, value) => {
    const rows = [...(worksheet.rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], [key]: value };
    onUpdate({ rows });
  }, [worksheet.rows, onUpdate]);

  const removeRow = useCallback((rowIdx) => {
    const rows = (worksheet.rows || []).filter((_, i) => i !== rowIdx);
    onUpdate({ rows });
  }, [worksheet.rows, onUpdate]);

  // ── Summary editable field update ──
  const updateSummaryField = useCallback((key, value) => {
    onUpdate({ summary: { ...(worksheet.summary || {}), [key]: value } });
  }, [worksheet.summary, onUpdate]);

  // ── Reconciliation info ──
  const reconInfo = worksheet.summary?.reconciliation;
  const hasRecon = typeof onRunReconciliation === 'function';

  const attachmentCount = (worksheet.attachments || []).length;

  return (
    <div className="space-y-5" dir="rtl">

      {/* ═══ 1. Header ═══ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileSpreadsheet className="w-6 h-6 text-green-700 shrink-0" />
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => {
              if (editTitle !== worksheet.label) onUpdate({ label: editTitle });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            className="text-xl font-bold border-none p-0 h-auto focus-visible:ring-1 focus-visible:ring-green-400 bg-transparent"
            dir="rtl"
          />
          <Badge variant="outline" className="shrink-0 text-xs">
            {worksheet.type?.replace(/_/g, ' ') || 'כללי'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status toggles */}
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => onUpdate({ status: s.key })}
              className={`px-3 py-1.5 text-xs rounded-full transition-all border ${
                worksheet.status === s.key
                  ? s.color + ' font-bold ring-2 ring-offset-1 ring-current'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}

          {/* Attachments indicator */}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500 mr-2">
              <Paperclip className="w-3.5 h-3.5" />
              {attachmentCount}
            </span>
          )}

          {/* Delete */}
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700 hover:bg-red-50 mr-2">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ═══ 2. Summary bar ═══ */}
      {summaryItems.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {summaryItems.map((item, idx) => (
            <Card
              key={idx}
              className={`flex-1 min-w-[160px] ${
                item.highlight
                  ? item.value === 0
                    ? 'border-green-300 bg-green-50'
                    : 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <CardContent className="p-3">
                <span className="text-xs text-gray-500 block mb-1">{item.label}</span>
                {item.editable ? (
                  <SummaryEditableValue
                    value={item.value}
                    onChange={(v) => updateSummaryField(item.summaryKey, v)}
                  />
                ) : (
                  <span className={`text-lg font-bold block ${
                    item.highlight
                      ? item.value === 0 ? 'text-green-700' : 'text-red-600'
                      : 'text-gray-800'
                  }`} dir="ltr">
                    {item.isCount ? item.value : formatNumber(item.value)}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ 3. Interactive table ═══ */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-right font-medium text-gray-600 w-10 px-3">#</TableHead>
              {(worksheet.columns || []).map(col => (
                <TableHead
                  key={col.key}
                  className="text-right font-medium text-gray-600 min-w-[100px] px-3"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-10 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(worksheet.rows || []).map((row, rowIdx) => (
              <TableRow key={rowIdx} className="hover:bg-green-50/30 transition-colors">
                <TableCell className="text-gray-400 text-xs text-center px-3">{rowIdx + 1}</TableCell>
                {(worksheet.columns || []).map(col => (
                  <TableCell key={col.key} className="px-1 py-1">
                    <Input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={row[col.key] ?? ''}
                      onChange={(e) => updateRow(
                        rowIdx,
                        col.key,
                        col.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value,
                      )}
                      className="h-8 text-sm border-transparent hover:border-gray-300 focus:border-green-500 rounded"
                      dir={col.type === 'number' || col.type === 'date' ? 'ltr' : 'rtl'}
                    />
                  </TableCell>
                ))}
                <TableCell className="px-1 py-1 text-center">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(rowIdx)}>
                    <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {/* ── Auto-totals row ── */}
            {(worksheet.rows || []).length > 0 && (
              <TableRow className="border-t-2 border-green-300 bg-green-100 font-bold">
                <TableCell className="text-gray-600 text-xs px-3">סה"כ</TableCell>
                {(worksheet.columns || []).map(col => (
                  <TableCell key={col.key} className="px-3 py-2" dir="ltr">
                    {col.type === 'number' ? (
                      <span className="text-green-800">{formatNumber(columnTotals[col.key])}</span>
                    ) : ''}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>

      {/* ═══ 4. Reconciliation helper ═══ */}
      {hasRecon && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => onRunReconciliation(worksheet.id)}
              >
                <PlayCircle className="w-4 h-4" />
                הרץ התאמה
              </Button>
              {reconInfo && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    מותאמים: {reconInfo.matched ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-orange-600">
                    לא מותאמים: {reconInfo.unmatched ?? 0}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 5. Notes section ═══ */}
      <div>
        <span className="text-sm font-medium text-gray-600 mb-1 block">הערות</span>
        <Textarea
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          onBlur={() => {
            if (editNotes !== worksheet.notes) onUpdate({ notes: editNotes });
          }}
          placeholder="הערות לגליון עבודה..."
          rows={3}
          className="text-sm"
          dir="rtl"
        />
      </div>

      {/* ═══ 6. Attachments count (bottom indicator) ═══ */}
      {attachmentCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500 border-t pt-3">
          <Paperclip className="w-4 h-4" />
          <span>{attachmentCount} קבצים מצורפים</span>
        </div>
      )}
    </div>
  );
}

// ── Editable summary value (click to edit) ──
function SummaryEditableValue({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || 0);

  useEffect(() => { setDraft(value || 0); }, [value]);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(parseFloat(e.target.value) || 0)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        autoFocus
        className="h-8 text-lg font-bold p-1 w-full"
        dir="ltr"
      />
    );
  }

  return (
    <span
      className="text-lg font-bold text-gray-800 block cursor-pointer hover:text-blue-700 transition-colors"
      dir="ltr"
      onClick={() => setEditing(true)}
      title="לחץ לעריכה"
    >
      {formatNumber(value)}
    </span>
  );
}
