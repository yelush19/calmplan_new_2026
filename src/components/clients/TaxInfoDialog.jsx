import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

function InfoField({ label, value, copyable = true }) {
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(String(value));
    toast.success('הועתק ללוח');
  };
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-800 font-mono" dir="ltr">{value}</span>
        {copyable && (
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200">
            <Copy className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = React.Children.toArray(children).some(c => c !== null);
  if (!hasContent) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-bold text-gray-600 border-b border-gray-100 pb-1">{title}</h4>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

export default function TaxInfoDialog({ client, open, onClose }) {
  if (!client) return null;

  const tax = client.tax_info || {};
  const annual = tax.annual_tax_ids || {};
  const prev = tax.prev_year_ids || {};
  const currentYear = annual.current_year || new Date().getFullYear();
  const prevYear = Number(currentYear) - 1;

  const hasTaxData = tax.tax_id || tax.vat_file_number || tax.tax_deduction_file_number ||
    tax.social_security_file_number || annual.tax_advances_id || annual.deductions_id ||
    annual.social_security_id || client.entity_number;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-emerald-600" />
            פרטי מס - {client.name}
          </DialogTitle>
        </DialogHeader>

        {!hasTaxData ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            לא הוזנו פרטי מס עבור לקוח זה
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Basic IDs */}
            <Section title="פרטי זיהוי">
              <InfoField label="ח.פ. / ע.מ." value={client.entity_number} />
              <InfoField label="מספר זיהוי מס" value={tax.tax_id} />
              <InfoField label="תיק מע״מ" value={tax.vat_file_number} />
              <InfoField label="תיק ניכויים" value={tax.tax_deduction_file_number} />
              <InfoField label="תיק ביטוח לאומי" value={tax.social_security_file_number} />
            </Section>

            {/* Current Year IDs */}
            <Section title={`מזהים שנתיים - ${currentYear}`}>
              <InfoField label="מזהה מקדמות" value={annual.tax_advances_id} />
              {annual.tax_advances_percentage !== undefined && annual.tax_advances_percentage !== null && annual.tax_advances_percentage !== '' && (
                <InfoField label="אחוז מקדמות" value={`${annual.tax_advances_percentage}%`} />
              )}
              <InfoField label="מזהה ביטוח לאומי" value={annual.social_security_id} />
              <InfoField label="מזהה ניכויים" value={annual.deductions_id} />
            </Section>

            {/* Previous Year IDs */}
            {(prev.tax_advances_id || prev.social_security_id || prev.deductions_id) && (
              <Section title={`מזהים שנה קודמת - ${prevYear}`}>
                <InfoField label="מזהה מקדמות" value={prev.tax_advances_id} />
                {prev.tax_advances_percentage !== undefined && prev.tax_advances_percentage !== null && prev.tax_advances_percentage !== '' && (
                  <InfoField label="אחוז מקדמות" value={`${prev.tax_advances_percentage}%`} />
                )}
                <InfoField label="מזהה ביטוח לאומי" value={prev.social_security_id} />
                <InfoField label="מזהה ניכויים" value={prev.deductions_id} />
              </Section>
            )}

            {/* Direct Transmission indicator */}
            {tax.direct_transmission && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <CheckCircle className="w-4 h-4" />
                לקוח מחובר לשידורים ישירים
              </div>
            )}

            {/* Last updated */}
            {annual.last_updated && (
              <div className="text-[10px] text-gray-400 text-left" dir="ltr">
                Last updated: {new Date(annual.last_updated).toLocaleDateString('he-IL')}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
