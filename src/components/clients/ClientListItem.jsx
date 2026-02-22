import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Building, User, DollarSign, Trash2, UserCheck, FolderOpen } from 'lucide-react';

const statusUI = {
  active: { label: 'פעיל', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  onboarding_pending: { label: 'ממתין לקליטה', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  balance_sheet_only: { label: 'סגירת מאזן בלבד', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

const serviceTypeLabels = {
  bookkeeping: 'הנה"ח',
  bookkeeping_full: 'הנה"ח מלאה',
  vat_reporting: 'מע״מ',
  tax_advances: 'מקדמות',
  payroll: 'שכר',
  social_security: 'בל',
  deductions: 'ניכויים',
  annual_reports: 'מאזנים',
  reconciliation: 'התאמות',
  special_reports: 'דוחות מיוחדים',
  masav_employees: 'מס״ב עובדים',
  masav_social: 'מס״ב סוציאליות',
  masav_authorities: 'מס״ב רשויות',
  masav_suppliers: 'מס״ב ספקים',
  authorities: 'דיווח רשויות',
  authorities_payment: 'תשלום רשויות',
  operator_reporting: 'דיווח למתפעל',
  taml_reporting: 'דיווח לטמל',
  payslip_sending: 'משלוח תלושים',
  social_benefits: 'סוציאליות',
  reserve_claims: 'מילואים',
  pnl_reports: 'רוו"ה',
  admin: 'אדמין',
};

const serviceTypeColors = {
  // קבוצה 1 (ירוק): הנה"ח, התאמות, מאזנים, PNL
  bookkeeping: 'bg-green-100 text-green-800 border-green-200',
  bookkeeping_full: 'bg-green-100 text-green-800 border-green-200',
  reconciliation: 'bg-green-100 text-green-800 border-green-200',
  annual_reports: 'bg-green-100 text-green-800 border-green-200',
  pnl_reports: 'bg-green-100 text-green-800 border-green-200',
  // מע"מ ומקדמות
  vat_reporting: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  tax_advances: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  // קבוצה 2 (כחול): שכר, ביטוח לאומי, ניכויים
  payroll: 'bg-blue-100 text-blue-800 border-blue-200',
  social_security: 'bg-blue-100 text-blue-800 border-blue-200',
  deductions: 'bg-blue-100 text-blue-800 border-blue-200',
  authorities: 'bg-blue-100 text-blue-800 border-blue-200',
  authorities_payment: 'bg-blue-100 text-blue-800 border-blue-200',
  social_benefits: 'bg-blue-100 text-blue-800 border-blue-200',
  // קבוצה 3 (סגול): תלושים, מס"ב עובדים
  payslip_sending: 'bg-purple-100 text-purple-800 border-purple-200',
  masav_employees: 'bg-purple-100 text-purple-800 border-purple-200',
  // קבוצה 4 (כתום): מס"ב סוציאליות, מתפעל, טמל
  masav_social: 'bg-amber-100 text-amber-800 border-amber-200',
  masav_authorities: 'bg-amber-100 text-amber-800 border-amber-200',
  operator_reporting: 'bg-amber-100 text-amber-800 border-amber-200',
  taml_reporting: 'bg-amber-100 text-amber-800 border-amber-200',
  // קבוצה 5 (אינדיגו): מס"ב ספקים
  masav_suppliers: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  // שייכויות נוספות
  reserve_claims: 'bg-blue-100 text-blue-800 border-blue-200',
  admin: 'bg-green-100 text-green-800 border-green-200',
  special_reports: 'bg-green-100 text-green-800 border-green-200',
};

// סדר מיון לפי קבוצת צבעים
const serviceGroupOrder = {
  bookkeeping: 1, bookkeeping_full: 1, reconciliation: 1,
  annual_reports: 1, pnl_reports: 1, admin: 1, special_reports: 1,
  vat_reporting: 2, tax_advances: 2,
  payroll: 3, social_security: 3, deductions: 3,
  authorities: 3, authorities_payment: 3, social_benefits: 3, reserve_claims: 3,
  payslip_sending: 4, masav_employees: 4,
  masav_social: 5, masav_authorities: 5, operator_reporting: 5, taml_reporting: 5,
  masav_suppliers: 6,
};

export default function ClientListItem({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete, onSelectFiles }) {
    const uiProps = statusUI[client.status] || statusUI.inactive;
    const mainContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0] || { name: client.contact_person, email: client.email, phone: client.phone };

    return (
        <div className={`group flex flex-col md:flex-row items-start md:items-center justify-between p-4 hover:bg-neutral-bg transition-colors duration-200 border-b border-neutral-light/50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Selection Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelect}
                    className="w-5 h-5"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-neutral-dark group-hover:text-emerald-600 transition-colors truncate">{client.name}</h3>
                  </div>
                  <div className="text-sm text-neutral-medium mt-1">{mainContact?.name || ''}</div>
                  {client.service_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[...client.service_types].sort((a, b) => (serviceGroupOrder[a] || 99) - (serviceGroupOrder[b] || 99)).map(st => (
                        <Badge key={st} className={`${serviceTypeColors[st] || 'bg-gray-50 text-gray-700 border-gray-200'} text-[10px] px-1.5 py-0 border`}>
                          {serviceTypeLabels[st] || st}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
            </div>
            
            <div className="w-full md:w-auto flex items-center justify-start gap-4 mt-3 md:mt-0">
                <a href={`tel:${mainContact?.phone}`} className="text-sm text-neutral-medium hover:text-litay-accent flex items-center gap-2">
                  <Phone className="w-4 h-4"/> 
                  <span className="hidden sm:inline">{mainContact?.phone}</span>
                </a>
                <a href={`mailto:${mainContact?.email}`} className="text-sm text-neutral-medium hover:text-litay-accent flex items-center gap-2">
                  <Mail className="w-4 h-4"/> 
                  <span className="hidden sm:inline truncate max-w-xs">{mainContact?.email}</span>
                </a>
            </div>

            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-4 mt-4 md:mt-0">
                <Badge className={`${uiProps.badge} flex items-center gap-1 border`}>
                    {client.status === 'onboarding_pending' && <UserCheck className="w-3 h-3"/>}
                    {uiProps.label}
                </Badge>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(client)} title="עריכת פרטים">
                        <Edit className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectAccounts(client)} title="ניהול חשבונות">
                        <Building className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectCollections(client)} title="ניהול גבייה">
                        <DollarSign className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectFiles?.(client)} title="ניהול קבצים">
                        <FolderOpen className="w-4 h-4 text-neutral-medium hover:text-litay-accent" />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקת לקוח">
                        <Trash2 className="w-4 h-4 text-status-error hover:text-status-error/80" />
                    </Button>
                </div>
            </div>
        </div>
    );
}