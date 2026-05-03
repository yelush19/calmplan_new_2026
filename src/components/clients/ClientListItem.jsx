import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Building, DollarSign, Trash2, UserCheck, FolderOpen, ChevronLeft } from 'lucide-react';

const statusUI = {
  active: { label: 'פעיל', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  onboarding_pending: { label: 'ממתין לקליטה', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  balance_sheet_only: { label: 'סגירת מאזן בלבד', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

const serviceTypeLabels = {
  // P1
  payroll: 'שכר',
  payroll_ancillary: 'נלווים לשכר',
  payroll_authorities: 'רשויות שכר',
  social_security: 'בל',
  deductions: 'ניכויים',
  // P2
  bookkeeping: 'הנה"ח',
  bookkeeping_full: 'הנה"ח מלאה',
  bookkeeping_production: 'ייצור',
  bookkeeping_reporting: 'דיווחים',
  bookkeeping_closing: 'סגירה',
  vat_reporting: 'מע״מ',
  vat: 'מע״מ',
  tax_advances: 'מקדמות',
  reconciliation: 'התאמות',
  pnl_reports: 'רוו"ה',
  masav_suppliers: 'מס״ב ספקים',
  // P3
  admin: 'אדמין',
  office: 'משרד',
  // P5
  annual_reports: 'מאזנים',
  personal_reports: 'דוחות אישיים',
  // Legacy
  masav_employees: 'מס״ב עובדים',
  masav_social: 'מס״ב סוציאליות',
  masav_authorities: 'מס״ב רשויות',
  payslip_sending: 'משלוח תלושים',
  authorities: 'דיווח רשויות',
  authorities_payment: 'תשלום רשויות',
  operator_reporting: 'דיווח למתפעל',
  taml_reporting: 'דיווח לטמל',
  social_benefits: 'פנסיות וקרנות',
  reserve_claims: 'מילואים',
  special_reports: 'דוחות מיוחדים',
  consulting: 'ייעוץ',
};

// Branch grouping — V4.0
const SERVICE_TO_BRANCH = {
  // P2 הנה"ח
  bookkeeping: 'P2', bookkeeping_full: 'P2', bookkeeping_production: 'P2',
  bookkeeping_reporting: 'P2', bookkeeping_closing: 'P2',
  vat_reporting: 'P2', vat: 'P2', tax_advances: 'P2',
  reconciliation: 'P2', pnl_reports: 'P2', masav_suppliers: 'P2',
  annual_reports: 'P2', personal_reports: 'P2', special_reports: 'P2',
  admin: 'P2', office: 'P2',
  // P1 שכר
  payroll: 'P1', payroll_ancillary: 'P1', payroll_authorities: 'P1',
  social_security: 'P1', deductions: 'P1',
  authorities: 'P1', authorities_payment: 'P1', social_benefits: 'P1', reserve_claims: 'P1',
  payslip_sending: 'P1', masav_employees: 'P1',
  masav_social: 'P1', masav_authorities: 'P1', operator_reporting: 'P1', taml_reporting: 'P1',
  consulting: 'P1',
};

const BRANCH_DISPLAY = {
  P2: {
    order: 1,
    label: 'הנה"ח',
    headerBg: 'bg-[#1a472a]',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  P1: {
    order: 2,
    label: 'שכר',
    headerBg: 'bg-[#4a6274]',
    badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
  },
};

export default function ClientListItem({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete, onSelectFiles, onSelectProviders }) {
    const uiProps = statusUI[client.status] || statusUI.inactive;
    const mainContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0] || { name: client.contact_person, email: client.email, phone: client.phone };

    // Group services by branch
    const branchGroups = {};
    (client.service_types || []).forEach(svc => {
      const branch = SERVICE_TO_BRANCH[svc] || 'OTHER';
      if (!branchGroups[branch]) branchGroups[branch] = [];
      branchGroups[branch].push(svc);
    });

    const sortedBranches = Object.entries(branchGroups).sort(([a], [b]) => {
      const orderA = BRANCH_DISPLAY[a]?.order ?? 99;
      const orderB = BRANCH_DISPLAY[b]?.order ?? 99;
      return orderA - orderB;
    });

    // Tax IDs for compact display
    const ti = client.tax_info || {};
    const annual = ti.annual_tax_ids || {};
    const taxIds = [
      client.entity_number && { l: 'ח"פ', v: client.entity_number },
      ti.tax_deduction_file_number && { l: 'תיק ניכויים', v: ti.tax_deduction_file_number },
      annual.deductions_id && { l: 'מזהה ניכויים', v: annual.deductions_id },
      annual.tax_advances_id && { l: 'מזהה מקדמות', v: annual.tax_advances_id },
    ].filter(Boolean);

    // Frequency labels
    const ri = client.reporting_info || {};
    const freqLabel = (f) => f === 'monthly' ? 'חודשי' : f === 'bimonthly' ? 'דו-חודשי' : f === 'quarterly' ? 'רבעוני' : f === 'not_applicable' ? '' : f || '';
    const frequencies = [
      ri.vat_reporting_frequency && ri.vat_reporting_frequency !== 'not_applicable' && { l: 'מע"מ', v: freqLabel(ri.vat_reporting_frequency) },
      ri.payroll_frequency && ri.payroll_frequency !== 'not_applicable' && { l: 'שכר', v: freqLabel(ri.payroll_frequency) },
      ri.tax_advances_frequency && ri.tax_advances_frequency !== 'not_applicable' && { l: 'מקדמות', v: freqLabel(ri.tax_advances_frequency) },
      ri.social_security_frequency && ri.social_security_frequency !== 'not_applicable' && { l: 'ב"ל', v: freqLabel(ri.social_security_frequency) },
      ri.deductions_frequency && ri.deductions_frequency !== 'not_applicable' && { l: 'ניכויים', v: freqLabel(ri.deductions_frequency) },
    ].filter(Boolean);

    return (
        <div className={`group border rounded-xl mx-1 my-1 transition-all duration-200 ${isSelected ? 'bg-sky-50/50 border-blue-300 shadow-sm' : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm'}`}>
            {/* Row 1: Name + Status + Contact + Actions */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100">
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} className="w-4 h-4" />
                </div>

                <Badge className={`${uiProps.badge} border text-[11px] font-bold px-2 py-0.5 shrink-0`}>
                    {uiProps.label}
                </Badge>

                <h3 className="text-sm font-black text-gray-900 truncate">{client.name}</h3>

                {mainContact?.name && mainContact.name !== client.contact_person && (
                  <span className="text-xs text-slate-400 shrink-0">👤 {mainContact.name}</span>
                )}

                <div className="flex-1" />

                {mainContact?.phone && (
                  <a href={`tel:${mainContact.phone}`} className="text-xs text-gray-500 hover:text-emerald-700 flex items-center gap-1 shrink-0">
                    <Phone className="w-3 h-3" />{mainContact.phone}
                  </a>
                )}
                {mainContact?.email && (
                  <a href={`mailto:${mainContact.email}`} className="text-xs text-gray-500 hover:text-emerald-700 flex items-center gap-1 shrink-0 max-w-[200px] truncate">
                    <Mail className="w-3 h-3" />{mainContact.email}
                  </a>
                )}

                <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(client)} title="עריכה" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-lg"><Edit className="w-3.5 h-3.5 text-gray-400" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectAccounts(client)} title="חשבונות" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-lg"><Building className="w-3.5 h-3.5 text-gray-400" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectFiles?.(client)} title="קבצים" className="h-7 w-7 hover:bg-white hover:shadow-sm rounded-lg"><FolderOpen className="w-3.5 h-3.5 text-gray-400" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקה" className="h-7 w-7 hover:bg-orange-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></Button>
                </div>
            </div>

            {/* Row 2: Services (frequencies) — compact */}
            {frequencies.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-1.5 border-b border-gray-50">
                {frequencies.map(({ l, v }) => (
                  <span key={l} className="text-[11px] text-slate-500">
                    <span className="font-bold">{l}:</span> {v}
                  </span>
                ))}
              </div>
            )}

            {/* Row 3: Tax IDs — compact, click to copy */}
            {taxIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-1.5">
                {taxIds.map(({ l, v }) => (
                  <span key={l} className="text-[11px] text-slate-400 cursor-pointer hover:text-blue-500"
                    title={`${l}: ${v} — לחצי להעתקה`}
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(v); }}>
                    <span className="font-semibold">{l}:</span> {v}
                  </span>
                ))}
              </div>
            )}

            {/* Row 4: Direct income/expense software access — chips. Lets the
                user spot at a glance which clients she has direct access to,
                without opening each card. Only shown when there is at least
                one software linked. */}
            {Array.isArray(client.income_software_access) && client.income_software_access.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5 border-t border-gray-50 bg-cyan-50/30">
                <span className="text-[11px] font-semibold text-cyan-700">🖥️ גישה ישירה:</span>
                {client.income_software_access.map((entry, idx) => {
                  const name = typeof entry === 'string' ? entry : (entry?.name || '');
                  if (!name) return null;
                  return (
                    <span key={idx} className="text-[11px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
        </div>
    );
}
