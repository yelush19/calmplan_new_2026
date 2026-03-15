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

// Branch grouping — matches ClientCard exactly
const SERVICE_TO_BRANCH = {
  // P2 הנה"ח ודוחות
  bookkeeping: 'P2', bookkeeping_full: 'P2', reconciliation: 'P2',
  annual_reports: 'P2', pnl_reports: 'P2', admin: 'P2', special_reports: 'P2',
  masav_suppliers: 'P2', vat_reporting: 'P2', tax_advances: 'P2',
  // P1 שכר
  payroll: 'P1', social_security: 'P1', deductions: 'P1',
  authorities: 'P1', authorities_payment: 'P1', social_benefits: 'P1', reserve_claims: 'P1',
  payslip_sending: 'P1', masav_employees: 'P1',
  masav_social: 'P1', masav_authorities: 'P1', operator_reporting: 'P1', taml_reporting: 'P1',
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

export default function ClientListItem({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete, onSelectFiles }) {
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

    return (
        <div className={`group flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-3 transition-all duration-200 border-b-2 border-gray-100 hover:bg-gray-50/80 ${isSelected ? 'bg-blue-50/60 border-r-4 border-r-blue-500' : 'hover:border-r-4 hover:border-r-emerald-300'}`}>
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
                      <h3 className="text-base font-bold text-gray-800 group-hover:text-emerald-700 transition-colors truncate">{client.name}</h3>
                  </div>

                  {/* Services grouped by branch — matching card layout */}
                  {sortedBranches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {sortedBranches.map(([branchId, svcs]) => {
                        const branchCfg = BRANCH_DISPLAY[branchId];
                        if (!branchCfg) {
                          // Unknown branch — plain badges
                          return svcs.map(st => (
                            <Badge key={st} className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0 border">
                              {serviceTypeLabels[st] || st}
                            </Badge>
                          ));
                        }
                        return (
                          <div key={branchId} className="flex items-center gap-0.5">
                            <span className={`${branchCfg.headerBg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-r-md`}>
                              {branchCfg.label}
                            </span>
                            <div className="flex gap-0.5">
                              {svcs.map(st => (
                                <Badge key={st} className={`${branchCfg.badgeBg} text-[10px] px-1.5 py-0 border rounded-none last:rounded-l-md`}>
                                  {serviceTypeLabels[st] || st}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            </div>

            <div className="w-full md:w-auto flex items-center justify-start gap-4 mt-3 md:mt-0">
                {mainContact?.phone && (
                  <a href={`tel:${mainContact.phone}`} className="text-sm text-gray-500 hover:text-emerald-700 flex items-center gap-1.5 transition-colors">
                    <Phone className="w-3.5 h-3.5"/>
                    <span className="hidden sm:inline">{mainContact.phone}</span>
                  </a>
                )}
                {mainContact?.email && (
                  <a href={`mailto:${mainContact.email}`} className="text-sm text-gray-500 hover:text-emerald-700 flex items-center gap-1.5 transition-colors">
                    <Mail className="w-3.5 h-3.5"/>
                    <span className="hidden sm:inline truncate max-w-xs">{mainContact.email}</span>
                  </a>
                )}
            </div>

            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 mt-3 md:mt-0">
                <Badge className={`${uiProps.badge} flex items-center gap-1 border text-xs font-semibold`}>
                    {client.status === 'onboarding_pending' && <UserCheck className="w-3 h-3"/>}
                    {uiProps.label}
                </Badge>
                <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(client)} title="עריכת פרטים" className="h-8 w-8 hover:bg-white hover:shadow-sm">
                        <Edit className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectAccounts(client)} title="ניהול חשבונות" className="h-8 w-8 hover:bg-white hover:shadow-sm">
                        <Building className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectCollections(client)} title="ניהול גבייה" className="h-8 w-8 hover:bg-white hover:shadow-sm">
                        <DollarSign className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectFiles?.(client)} title="ניהול קבצים" className="h-8 w-8 hover:bg-white hover:shadow-sm">
                        <FolderOpen className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקת לקוח" className="h-8 w-8 hover:bg-rose-50">
                        <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-500" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
