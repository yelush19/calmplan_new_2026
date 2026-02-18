import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'חוזה' },
  { value: 'monthly_report', label: 'דוח חודשי' },
  { value: 'payslip', label: 'תלוש שכר' },
  { value: 'correspondence', label: 'התכתבות' },
  { value: 'tax_report', label: 'דוח מס' },
  { value: 'invoice', label: 'חשבונית' },
  { value: 'receipt', label: 'קבלה' },
  { value: 'bank_statement', label: 'דוח בנק' },
  { value: 'other', label: 'אחר' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'final', label: 'סופי' },
  { value: 'pending_approval', label: 'ממתין לאישור' },
  { value: 'approved', label: 'אושר' },
];

const MONTHS = [
  { value: '', label: 'לא רלוונטי' },
  { value: '01', label: 'ינואר' },
  { value: '02', label: 'פברואר' },
  { value: '03', label: 'מרץ' },
  { value: '04', label: 'אפריל' },
  { value: '05', label: 'מאי' },
  { value: '06', label: 'יוני' },
  { value: '07', label: 'יולי' },
  { value: '08', label: 'אוגוסט' },
  { value: '09', label: 'ספטמבר' },
  { value: '10', label: 'אוקטובר' },
  { value: '11', label: 'נובמבר' },
  { value: '12', label: 'דצמבר' },
];

function autoDetectYear(fileName) {
  const match = fileName.match(/(20\d{2})/);
  return match ? match[1] : String(new Date().getFullYear());
}

function autoDetectMonth(fileName) {
  const match = fileName.match(/[-_](0[1-9]|1[0-2])[-_./]/);
  return match ? match[1] : '';
}

function autoDetectDocumentType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('חוזה') || lower.includes('contract') || lower.includes('agreement')) return 'contract';
  if (lower.includes('תלוש') || lower.includes('payslip') || lower.includes('salary')) return 'payslip';
  if (lower.includes('דוח') || lower.includes('report')) return 'monthly_report';
  if (lower.includes('חשבונית') || lower.includes('invoice')) return 'invoice';
  if (lower.includes('קבלה') || lower.includes('receipt')) return 'receipt';
  if (lower.includes('בנק') || lower.includes('bank')) return 'bank_statement';
  if (lower.includes('מס') || lower.includes('tax')) return 'tax_report';
  return 'other';
}

export default function FileMetadataForm({ fileData, onSave, onCancel, isNew = false }) {
  const [formData, setFormData] = useState({
    document_type: 'other',
    year: String(new Date().getFullYear()),
    month: '',
    status: 'final',
    notes: '',
    ...fileData,
  });

  useEffect(() => {
    if (isNew && fileData?.file_name) {
      setFormData(prev => ({
        ...prev,
        document_type: autoDetectDocumentType(fileData.file_name),
        year: autoDetectYear(fileData.file_name),
        month: autoDetectMonth(fileData.file_name),
      }));
    }
  }, [fileData?.file_name, isNew]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Document Type */}
        <div className="space-y-1.5">
          <Label>סוג מסמך</Label>
          <Select value={formData.document_type} onValueChange={(v) => handleChange('document_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map(dt => (
                <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label>סטטוס</Label>
          <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year */}
        <div className="space-y-1.5">
          <Label>שנה</Label>
          <Select value={formData.year} onValueChange={(v) => handleChange('year', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month */}
        <div className="space-y-1.5">
          <Label>חודש</Label>
          <Select value={formData.month || 'none'} onValueChange={(v) => handleChange('month', v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value || 'none'} value={m.value || 'none'}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>הערות</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="הערות חופשיות..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 ml-2" />
            ביטול
          </Button>
        )}
        <Button type="submit" className="bg-primary hover:bg-accent">
          <Save className="w-4 h-4 ml-2" />
          שמור
        </Button>
      </div>
    </form>
  );
}

export { DOCUMENT_TYPES, STATUS_OPTIONS, MONTHS };
