import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Building, User, DollarSign, Trash2, UserCheck } from 'lucide-react';

const statusUI = {
  active: { label: 'פעיל', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', badge: 'bg-red-100 text-red-800 border-red-200' },
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
  consulting: 'ייעוץ',
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
  bookkeeping: 'bg-green-100 text-green-800 border-green-200',
  bookkeeping_full: 'bg-green-100 text-green-800 border-green-200',
  vat_reporting: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  tax_advances: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  payroll: 'bg-teal-100 text-teal-800 border-teal-200',
  social_security: 'bg-teal-100 text-teal-800 border-teal-200',
  deductions: 'bg-teal-100 text-teal-800 border-teal-200',
  annual_reports: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  reconciliation: 'bg-blue-100 text-blue-800 border-blue-200',
  consulting: 'bg-gray-100 text-gray-800 border-gray-200',
  special_reports: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  masav_employees: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  masav_social: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  masav_authorities: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  masav_suppliers: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  authorities: 'bg-teal-100 text-teal-800 border-teal-200',
  authorities_payment: 'bg-teal-100 text-teal-800 border-teal-200',
  operator_reporting: 'bg-teal-100 text-teal-800 border-teal-200',
  taml_reporting: 'bg-teal-100 text-teal-800 border-teal-200',
  payslip_sending: 'bg-purple-100 text-purple-800 border-purple-200',
  social_benefits: 'bg-purple-100 text-purple-800 border-purple-200',
  reserve_claims: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pnl_reports: 'bg-orange-100 text-orange-800 border-orange-200',
  admin: 'bg-gray-100 text-gray-800 border-gray-200',
};


export default function ClientListItem({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete }) {
    const uiProps = statusUI[client.status] || statusUI.inactive;
    const mainContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0] || { name: client.contact_person, email: client.email, phone: client.phone };

    return (
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 hover:bg-neutral-bg transition-colors duration-200 border-b border-neutral-light/50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
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
                      <h3 className="text-lg font-semibold text-neutral-dark truncate">{client.name}</h3>
                  </div>
                  <div className="text-sm text-neutral-medium mt-1">{mainContact?.name || ''}</div>
                  {client.service_types?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {client.service_types.map(st => (
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
                     <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקת לקוח">
                        <Trash2 className="w-4 h-4 text-status-error hover:text-status-error/80" />
                    </Button>
                </div>
            </div>
        </div>
    );
}