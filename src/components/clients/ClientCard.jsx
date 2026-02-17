
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Building, User, DollarSign, Trash2, UserCheck, FileText, ChevronDown, ChevronUp, CheckSquare, Users, Briefcase, Calendar, MoreVertical, CheckCircle, Clock, Heart, AlertCircle, Banknote, CreditCard, BookUser } from 'lucide-react';

const serviceTypeLabels = {
    bookkeeping: 'הנהלת חשבונות',
    bookkeeping_full: 'הנהלת חשבונות מלאה',
    vat_reporting: 'דיווחי מע״מ',
    tax_advances: 'מקדמות מס',
    payroll: 'שכר',
    social_security: 'ביטוח לאומי',
    deductions: 'מ״ה ניכויים',
    annual_reports: 'מאזנים / דוחות שנתיים',
    reconciliation: 'התאמות חשבונות',
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
    reserve_claims: 'תביעות מילואים',
    pnl_reports: 'דוחות רווח והפסד',
    admin: 'אדמיניסטרציה',
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

// סדר מיון לפי קבוצת צבעים - אותה קטגוריה באותה שורה
const serviceGroupOrder = {
    // קבוצה 1 (ירוק): הנה"ח
    bookkeeping: 1, bookkeeping_full: 1, reconciliation: 1,
    annual_reports: 1, pnl_reports: 1, admin: 1, special_reports: 1,
    // מע"מ ומקדמות (אמרלד)
    vat_reporting: 2, tax_advances: 2,
    // קבוצה 2 (כחול): שכר
    payroll: 3, social_security: 3, deductions: 3,
    authorities: 3, authorities_payment: 3, social_benefits: 3, reserve_claims: 3,
    // קבוצה 3 (סגול): תלושים
    payslip_sending: 4, masav_employees: 4,
    // קבוצה 4 (כתום): מס"ב סוציאליות
    masav_social: 5, masav_authorities: 5, operator_reporting: 5, taml_reporting: 5,
    // קבוצה 5 (אינדיגו): מס"ב ספקים
    masav_suppliers: 6,
};

const statusUI = {
  active: { label: 'פעיל', icon: CheckCircle, color: 'text-green-600', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', icon: Clock, color: 'text-orange-600', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', icon: Heart, color: 'text-gray-500', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', icon: Trash2, color: 'text-red-600', badge: 'bg-red-100 text-red-800 border-red-200' },
  onboarding_pending: { label: 'ממתין לקליטה', icon: UserCheck, color: 'text-purple-600', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  balance_sheet_only: { label: 'סגירת מאזן בלבד', icon: FileText, color: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

export default function ClientCard({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete, onSelectTasks }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [accountsSummary, setAccountsSummary] = useState(null);
  const [accountantName, setAccountantName] = useState(null);

  // Load accounts summary and accountant on mount
  useEffect(() => {
    const loadAccountsSummary = async () => {
      try {
        const { ClientAccount } = await import('@/api/entities');
        const accounts = await ClientAccount.filter({ client_id: client.id }, null, 100);
        if (accounts && accounts.length > 0) {
          const banks = accounts.filter(a => a.account_type === 'bank').length;
          const cards = accounts.filter(a => a.account_type === 'credit_card').length;
          const other = accounts.length - banks - cards;
          setAccountsSummary({ total: accounts.length, banks, cards, other });
        }
      } catch (error) {
        // silently fail
      }
    };
    const loadAccountant = async () => {
      try {
        const { ClientServiceProvider, ServiceProvider } = await import('@/api/entities');
        const links = await ClientServiceProvider.filter({ client_id: client.id }, null, 50);
        if (links && links.length > 0) {
          const allProviders = await ServiceProvider.list(null, 500);
          const providerMap = {};
          (allProviders || []).forEach(p => { providerMap[p.id] = p; });
          for (const link of links) {
            const provider = providerMap[link.service_provider_id];
            if (provider && (provider.type === 'cpa' || provider.type === 'cpa_representative')) {
              setAccountantName(provider.name + (provider.company_name ? ` (${provider.company_name})` : ''));
              break;
            }
          }
        }
      } catch { /* silently fail */ }
    };
    loadAccountsSummary();
    loadAccountant();
  }, [client.id]);

  const uiProps = statusUI[client.status] || statusUI.inactive;
  const mainContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0] || { name: client.contact_person, email: client.email, phone: client.phone };
  const StatusIcon = uiProps.icon;

  // טעינת משימות קשורות ללקוח
  const loadRelatedTasks = async () => {
    if (isLoadingTasks) return;
    
    setIsLoadingTasks(true);
    try {
      const { Task } = await import('@/api/entities');
      // FIX: Increased read limit
      const tasks = await Task.filter({ client_id: client.id }, null, 100);
      setRelatedTasks(tasks || []);
    } catch (error) {
      console.error("Error loading related tasks:", error);
      setRelatedTasks([]);
    }
    setIsLoadingTasks(false);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    // טען משימות רק כשמרחיבים בפעם הראשונה
    if (newExpanded && relatedTasks.length === 0 && !isLoadingTasks) {
      loadRelatedTasks();
    }
  };
  
  const services = [...(client.service_types || [])].sort((a, b) => (serviceGroupOrder[a] || 99) - (serviceGroupOrder[b] || 99));
  const reportingInfo = client.reporting_info || {};

  const frequencyLabels = {
    monthly: 'חודשי',
    bimonthly: 'דו-חודשי',
    quarterly: 'רבעוני',
    semi_annual: 'חצי שנתי',
    check_needed: 'לבדיקה',
    not_applicable: 'לא רלוונטי',
  };

  // Row 1: מע"מ ומקדמות
  const reportingRow1 = [
    { key: 'vat_reporting_frequency', label: 'מע"מ' },
    { key: 'tax_advances_frequency', label: 'מקדמות' },
  ].filter(f => reportingInfo[f.key] && reportingInfo[f.key] !== 'not_applicable');

  // Row 2: שכר, ב"ל וניכויים (ללקוחות עם שכר)
  const reportingRow2 = [
    { key: 'payroll_frequency', label: 'שכר' },
    { key: 'social_security_frequency', label: 'ב"ל' },
    { key: 'deductions_frequency', label: 'ניכויים' },
  ].filter(f => reportingInfo[f.key] && reportingInfo[f.key] !== 'not_applicable');

  const hasReporting = reportingRow1.length > 0 || reportingRow2.length > 0;

  return (
    <Card className={`w-full transform transition-all duration-300 shadow-sm hover:shadow-lg border flex flex-col group ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/30' : 'border-neutral-light/80 bg-white'}`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex justify-between items-start gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Selection Checkbox */}
              <div className="mt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onToggleSelect}
                  className="w-5 h-5"
                />
              </div>
              
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800 group-hover:text-emerald-600 transition-colors leading-tight min-w-0 flex-1">
                <Building className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <span className="truncate">{client.name}</span>
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`${uiProps.badge} text-xs flex-shrink-0 flex items-center gap-1 border`}>
                  <StatusIcon className={`w-3 h-3 ${uiProps.color}`} />
                  {uiProps.label}
              </Badge>
              {relatedTasks.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {relatedTasks.length} משימות
                </Badge>
              )}
            </div>
        </div>
        {mainContact?.name && (
          <p className="text-sm text-gray-600 flex items-center gap-2 mt-1 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            <span>{mainContact.name}</span>
          </p>
        )}
      </CardHeader>
      
      <CardContent className="py-3 flex-grow overflow-y-auto">
        {(mainContact?.phone || mainContact?.email) && (
          <div className="space-y-2 mb-3">
            {mainContact.phone && (
              <a href={`tel:${mainContact.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-700 transition-colors">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{mainContact.phone}</span>
              </a>
            )}
            {mainContact.email && (
              <a href={`mailto:${mainContact.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-700 transition-colors">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{mainContact.email}</span>
              </a>
            )}
          </div>
        )}
        
        {/* רו"ח */}
        {accountantName && (
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-2 pb-2 border-b border-gray-100">
            <BookUser className="w-3 h-3 text-indigo-500 flex-shrink-0" />
            <span className="font-medium text-indigo-700">רו"ח:</span>
            <span>{accountantName}</span>
          </div>
        )}

        {/* תדירויות דיווח - שורה 1: מע"מ ומקדמות, שורה 2: שכר ב"ל וניכויים */}
        {hasReporting && (
          <div className="border-t border-gray-100 pt-2 min-h-[3rem]">
            {reportingRow1.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {reportingRow1.map(f => (
                  <span key={f.key} className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="font-medium">{f.label}:</span>
                    <span className={reportingInfo[f.key] === 'bimonthly' ? 'text-amber-600 font-semibold' : ''}>
                      {frequencyLabels[reportingInfo[f.key]] || reportingInfo[f.key]}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {reportingRow2.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mt-1">
                {reportingRow2.map(f => (
                  <span key={f.key} className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="font-medium">{f.label}:</span>
                    <span className={reportingInfo[f.key] === 'bimonthly' ? 'text-amber-600 font-semibold' : ''}>
                      {frequencyLabels[reportingInfo[f.key]] || reportingInfo[f.key]}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* שירותים */}
        {services.length > 0 && (
          <div className="border-t border-gray-100 pt-3 mt-2">
            <div className="flex flex-wrap gap-1.5">
              {services.map(service => (
                <Badge key={service} className={`${serviceTypeColors[service] || 'bg-gray-50 text-gray-700 border-gray-200'} text-xs px-2 py-1 border`}>
                  {serviceTypeLabels[service] || service.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tax IDs - quick reference */}
        {(client.tax_info?.tax_deduction_file_number || client.tax_info?.annual_tax_ids?.tax_advances_id || client.entity_number) && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {client.entity_number && (
                <span><span className="font-medium text-gray-600">ח"פ:</span> {client.entity_number}</span>
              )}
              {client.tax_info?.tax_deduction_file_number && (
                <span><span className="font-medium text-gray-600">פנקס ניכויים:</span> {client.tax_info.tax_deduction_file_number}</span>
              )}
              {client.tax_info?.annual_tax_ids?.tax_advances_id && (
                <span><span className="font-medium text-gray-600">פנקס מקדמות:</span> {client.tax_info.annual_tax_ids.tax_advances_id}</span>
              )}
            </div>
          </div>
        )}

        {/* Bank accounts summary */}
        {accountsSummary && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
              {accountsSummary.banks > 0 && (
                <span className="flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-blue-500" />
                  {accountsSummary.banks} חשבונות בנק
                </span>
              )}
              {accountsSummary.cards > 0 && (
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-purple-500" />
                  {accountsSummary.cards} כרט' אשראי
                </span>
              )}
              {accountsSummary.other > 0 && (
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3 text-gray-500" />
                  {accountsSummary.other} נוספים
                </span>
              )}
            </div>
          </div>
        )}

        {/* הצגת משימות קשורות */}
        {isExpanded && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">משימות קשורות</h4>
              {isLoadingTasks && <div className="text-xs text-gray-500">טוען...</div>}
            </div>
            {relatedTasks.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {relatedTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span className="truncate flex-1">{task.title}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {task.status === 'completed' ? 'הושלם' : 
                       task.status === 'in_progress' ? 'בעבודה' : 'ממתין'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : !isLoadingTasks ? (
              <p className="text-xs text-gray-500">אין משימות קשורות</p>
            ) : null}

            {/* הצגת פרטי אינטגרציה */}
            {(client.integration_info?.monday_board_id || client.integration_info?.calmplan_id) && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <h5 className="text-xs font-medium text-gray-600 mb-1">פרטי אינטגרציה</h5>
                <div className="space-y-1 text-xs text-gray-500">
                  {client.integration_info?.monday_board_id && (
                    <div>לוח Monday: {client.integration_info.monday_board_id}</div>
                  )}
                  {client.integration_info?.monday_group_id && (
                    <div>קבוצה: {client.integration_info.monday_group_id}</div>
                  )}
                  {client.integration_info?.calmplan_id && (
                    <div>CalmPlan ID: {client.integration_info.calmplan_id}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="grid grid-cols-6 gap-1 p-2 border-t bg-neutral-light/20 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(client)} className="h-8 text-xs text-neutral-medium hover:bg-neutral-light/50 hover:text-litay-accent">
            <Edit className="w-3 h-3 ml-1" />
            עריכה
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectTasks(client)} className="h-8 text-xs text-neutral-medium hover:bg-neutral-light/50 hover:text-litay-accent">
            <CheckSquare className="w-3 h-3 ml-1" />
            משימות
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectAccounts(client)} className="h-8 text-xs text-neutral-medium hover:bg-neutral-light/50 hover:text-litay-accent">
            <Building className="w-3 h-3 ml-1" />
            חשבונות
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectCollections(client)} className="h-8 text-xs text-neutral-medium hover:bg-neutral-light/50 hover:text-litay-accent">
              <DollarSign className="w-3 h-3 ml-1" />
              גבייה
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectContracts(client)} className="h-8 text-xs text-neutral-medium hover:bg-neutral-light/50 hover:text-litay-accent">
              <FileText className="w-3 h-3 ml-1" />
              חוזים
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 text-xs text-status-error hover:bg-status-error/10 hover:text-status-error">
              <Trash2 className="w-3 h-3 ml-1" />
              מחיקה
          </Button>
      </CardFooter>
    </Card>
  );
}
