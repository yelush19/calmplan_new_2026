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
        <div className={`group flex flex-col md:flex-row items-start md:items-center justify-between px-5 py-4 transition-all duration-300 border-b border-gray-100 rounded-xl mx-1 my-0.5 ${isSelected ? 'bg-gradient-to-l from-blue-50/80 to-sky-50/40 border-r-4 border-r-blue-500 shadow-sm' : 'hover:bg-gradient-to-l hover:from-emerald-50/30 hover:to-white hover:border-r-4 hover:border-r-emerald-400 hover:shadow-sm'}`}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
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
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors truncate">{client.name}</h3>
                  </div>

                  {/* Services grouped by branch — matching card layout */}
                  {sortedBranches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {sortedBranches.map(([branchId, svcs]) => {
                        const branchCfg = BRANCH_DISPLAY[branchId];
                        if (!branchCfg) {
                          // Unknown branch — plain badges
                          return svcs.map(st => (
                            <Badge key={st} className="bg-gray-50 text-gray-700 border-gray-300 text-xs px-2 py-0.5 border font-medium">
                              {serviceTypeLabels[st] || st}
                            </Badge>
                          ));
                        }
                        return (
                          <div key={branchId} className="flex items-center gap-0.5">
                            <span className={`${branchCfg.headerBg} text-white text-[11px] font-bold px-2 py-1 rounded-r-lg`}>
                              {branchCfg.label}
                            </span>
                            <div className="flex gap-0.5">
                              {svcs.map(st => (
                                <Badge key={st} className={`${branchCfg.badgeBg} text-xs px-2 py-0.5 border rounded-none last:rounded-l-lg font-medium`}>
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

            <div className="w-full md:w-auto flex items-center justify-start gap-5 mt-3 md:mt-0">
                {mainContact?.phone && (
                  <a href={`tel:${mainContact.phone}`} className="text-base text-gray-600 hover:text-emerald-700 flex items-center gap-2 transition-colors font-medium">
                    <Phone className="w-4 h-4"/>
                    <span className="hidden sm:inline">{mainContact.phone}</span>
                  </a>
                )}
                {mainContact?.email && (
                  <a href={`mailto:${mainContact.email}`} className="text-base text-gray-600 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                    <Mail className="w-4 h-4"/>
                    <span className="hidden sm:inline truncate max-w-xs">{mainContact.email}</span>
                  </a>
                )}
            </div>

            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 mt-3 md:mt-0">
                <Badge className={`${uiProps.badge} flex items-center gap-1.5 border text-sm font-bold px-3 py-1`}>
                    {client.status === 'onboarding_pending' && <UserCheck className="w-4 h-4"/>}
                    {uiProps.label}
                </Badge>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(client)} title="עריכת פרטים" className="h-9 w-9 hover:bg-white hover:shadow-sm rounded-lg">
                        <Edit className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-700" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectAccounts(client)} title="ניהול חשבונות" className="h-9 w-9 hover:bg-white hover:shadow-sm rounded-lg">
                        <Building className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-700" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectCollections(client)} title="ניהול גבייה" className="h-9 w-9 hover:bg-white hover:shadow-sm rounded-lg">
                        <DollarSign className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-700" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onSelectFiles?.(client)} title="ניהול קבצים" className="h-9 w-9 hover:bg-white hover:shadow-sm rounded-lg">
                        <FolderOpen className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-700" />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)} title="מחיקת לקוח" className="h-9 w-9 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4.5 h-4.5 text-gray-400 hover:text-red-500" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
