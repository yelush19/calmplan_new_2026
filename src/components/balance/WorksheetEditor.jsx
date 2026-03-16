import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileSpreadsheet, Plus, Trash2, CheckCircle, AlertCircle, Clock, Paperclip
} from 'lucide-react';

const STATUS_OPTIONS = [
  { key: 'draft', label: 'טיוטה', color: 'bg-gray-200 text-gray-700' },
  { key: 'in_review', label: 'בבדיקה', color: 'bg-blue-200 text-blue-700' },
  { key: 'approved', label: 'מאושר', color: 'bg-green-200 text-green-700' },
  { key: 'needs_fix', label: 'דורש תיקון', color: 'bg-orange-200 text-orange-700' },
];

export default function WorksheetEditor({ worksheet, onUpdate, onRemove }) {
  const [editTitle, setEditTitle] = useState(worksheet.title);
  const [editNotes, setEditNotes] = useState(worksheet.notes || '');

  // Reset state when switching worksheets
  useEffect(() => {
    setEditTitle(worksheet.title);
    setEditNotes(worksheet.notes || '');
  }, [worksheet.id]);

  // ── חישוב אוטומטי ──
  const totals = useMemo(() => {
    const rows = worksheet.rows || [];
    let totalDebit = 0;
    let totalCredit = 0;
    rows.forEach(row => {
      totalDebit += parseFloat(row.debit) || 0;
      totalCredit += parseFloat(row.credit) || 0;
    });
    return { totalDebit, totalCredit, balance: totalDebit - totalCredit };
  }, [worksheet.rows]);

  // ── שורות ──
  const addRow = () => {
    const newRow = {};
    (worksheet.columns || []).forEach(col => {
      newRow[col.key] = col.type === 'number' ? 0 : '';
    });
    onUpdate({ rows: [...(worksheet.rows || []), newRow] });
  };

  const updateRow = (rowIdx, key, value) => {
    const rows = [...(worksheet.rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], [key]: value };
    onUpdate({ rows });
  };

  const removeRow = (rowIdx) => {
    const rows = (worksheet.rows || []).filter((_, i) => i !== rowIdx);
    onUpdate({ rows });
  };

  // ── פורמט מספרים ──
  const formatNumber = (num) => {
    if (num == null || isNaN(num)) return '—';
    return new Intl.NumberFormat('he-IL').format(num);
  };

  return (
    <div className="space-y-6">
      {/* ── כותרת + סטטוס ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-green-700" />
          <div>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => onUpdate({ title: editTitle })}
              className="text-xl font-bold border-none p-0 h-auto focus-visible:ring-0"
            />
            {worksheet.account_code && (
              <span className="text-xs text-gray-500">חשבון: {worksheet.account_code}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => onUpdate({ status: s.key })}
                className={`px-2 py-1 text-xs rounded-full transition-all ${
                  worksheet.status === s.key ? s.color + ' font-bold ring-2 ring-offset-1' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700 mr-4">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── כרטיסי סיכום (יתרות) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="יתרת פתיחה"
          value={worksheet.opening_balance}
          onChange={(v) => onUpdate({ opening_balance: v })}
          formatNumber={formatNumber}
        />
        <SummaryCard
          label="יתרה לפי ספרים"
          value={worksheet.book_balance}
          onChange={(v) => onUpdate({ book_balance: v })}
          formatNumber={formatNumber}
        />
        <SummaryCard
          label="יתרה לביקורת"
          value={worksheet.audit_balance}
          onChange={(v) => onUpdate({ audit_balance: v })}
          formatNumber={formatNumber}
        />
        <div className="p-3 rounded-lg bg-gray-50 border">
          <span className="text-xs text-gray-500">הפרש</span>
          <p className={`text-lg font-bold ${
            (worksheet.book_balance - worksheet.audit_balance) === 0
              ? 'text-green-700'
              : 'text-red-600'
          }`}>
            {formatNumber(worksheet.book_balance - worksheet.audit_balance)}
          </p>
        </div>
      </div>

      {/* ── טבלת שורות (כמו אקסל) ── */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-gray-600 w-10">#</th>
              {(worksheet.columns || []).map(col => (
                <th key={col.key} className="px-3 py-2 text-right font-medium text-gray-600 min-w-[100px]">
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {(worksheet.rows || []).map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t hover:bg-green-50/30 transition-colors">
                <td className="px-3 py-1 text-gray-400 text-xs text-center">{rowIdx + 1}</td>
                {(worksheet.columns || []).map(col => (
                  <td key={col.key} className="px-1 py-1">
                    <Input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={row[col.key] ?? ''}
                      onChange={(e) => updateRow(
                        rowIdx,
                        col.key,
                        col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                      )}
                      className="h-8 text-sm border-transparent hover:border-gray-300 focus:border-green-500 rounded"
                      dir={col.type === 'number' || col.type === 'date' ? 'ltr' : 'rtl'}
                    />
                  </td>
                ))}
                <td className="px-1 py-1 text-center">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(rowIdx)}>
                    <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}

            {/* ── שורת סיכום ── */}
            {(worksheet.rows || []).length > 0 && (
              <tr className="border-t-2 border-green-200 bg-green-50 font-bold">
                <td className="px-3 py-2 text-gray-500 text-xs">סה"כ</td>
                {(worksheet.columns || []).map(col => (
                  <td key={col.key} className="px-3 py-2 text-left" dir="ltr">
                    {col.type === 'number' ? (
                      <span className="text-green-800">
                        {formatNumber(
                          (worksheet.rows || []).reduce(
                            (sum, r) => sum + (parseFloat(r[col.key]) || 0), 0
                          )
                        )}
                      </span>
                    ) : ''}
                  </td>
                ))}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>

      {/* ── הערות ── */}
      <div>
        <span className="text-sm font-medium text-gray-600 mb-1 block">הערות</span>
        <Textarea
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          onBlur={() => onUpdate({ notes: editNotes })}
          placeholder="הערות לגליון עבודה..."
          rows={3}
          className="text-sm"
          dir="rtl"
        />
      </div>
    </div>
  );
}

// ── כרטיס סיכום (יתרה) ──
function SummaryCard({ label, value, onChange, formatNumber }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || 0);

  useEffect(() => { setEditValue(value || 0); }, [value]);

  return (
    <div
      className="p-3 rounded-lg bg-gray-50 border cursor-pointer hover:border-green-300 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-xs text-gray-500">{label}</span>
      {isEditing ? (
        <Input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
          onBlur={() => {
            onChange(editValue);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(editValue);
              setIsEditing(false);
            }
          }}
          autoFocus
          className="h-8 text-lg font-bold mt-1 p-1"
          dir="ltr"
        />
      ) : (
        <p className="text-lg font-bold text-gray-800">{formatNumber(value)}</p>
      )}
    </div>
  );
}
