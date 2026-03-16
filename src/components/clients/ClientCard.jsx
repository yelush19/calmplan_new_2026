
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Edit, Building, User, DollarSign, Trash2, UserCheck, FileText, ChevronDown, ChevronUp, ChevronLeft, CheckSquare, Users, Briefcase, Calendar, MoreVertical, CheckCircle, Clock, Heart, AlertCircle, Banknote, CreditCard, BookUser, FolderOpen, Receipt, Layers, Link2 } from 'lucide-react';
import TaxInfoDialog from '@/components/clients/TaxInfoDialog';
import { ALL_SERVICES } from '@/config/processTemplates';
import { loadCompanyTree, isNodeEnabled, getEnabledNodeIds } from '@/services/processTreeService';
import { flattenTree } from '@/config/companyProcessTree';

// Fallback labels (used when tree hasn't loaded yet)
const DEFAULT_SERVICE_LABELS = {
    // V4.0 node keys
    bookkeeping: 'הנה"ח',
    vat: 'מע"מ',
    tax_advances: 'מקדמות',
    payroll: 'שכר',
    payroll_ancillary: 'נלווים לשכר',
    payroll_authorities: 'רשויות שכר',
    social_security: 'ביטוח לאומי',
    deductions: 'ניכויים',
    annual_reports: 'מאזנים / דוחות שנתיים',
    personal_reports: 'דוחות אישיים',
    reconciliation: 'התאמות',
    masav_suppliers: 'מס"ב ספקים',
    pnl_reports: 'רוו"ה',
    admin: 'אדמיניסטרציה',
    office: 'משרד',
    bookkeeping_production: 'ייצור',
    bookkeeping_reporting: 'דיווחים',
    bookkeeping_closing: 'סגירה',
    // Legacy keys (backward compat)
    bookkeeping_full: 'הנה"ח מלאה',
    vat_reporting: 'מע"מ',
    masav_employees: 'מס"ב עובדים',
    masav_social: 'מס"ב סוציאליות',
    payslip_sending: 'משלוח תלושים',
    authorities: 'רשויות',
    authorities_payment: 'תשלום רשויות',
    special_reports: 'דוחות מיוחדים',
};

const serviceTypeColors = {
    // P2 הנה"ח (סגול)
    bookkeeping: 'bg-purple-100 text-purple-800 border-purple-200',
    bookkeeping_production: 'bg-purple-100 text-purple-800 border-purple-200',
    bookkeeping_reporting: 'bg-purple-100 text-purple-800 border-purple-200',
    bookkeeping_closing: 'bg-purple-100 text-purple-800 border-purple-200',
    reconciliation: 'bg-purple-100 text-purple-800 border-purple-200',
    pnl_reports: 'bg-purple-100 text-purple-800 border-purple-200',
    masav_suppliers: 'bg-purple-100 text-purple-800 border-purple-200',
    vat: 'bg-violet-100 text-violet-800 border-violet-200',
    vat_reporting: 'bg-violet-100 text-violet-800 border-violet-200',
    tax_advances: 'bg-violet-100 text-violet-800 border-violet-200',
    // P1 שכר (כחול)
    payroll: 'bg-sky-100 text-sky-800 border-sky-200',
    payroll_ancillary: 'bg-sky-100 text-sky-800 border-sky-200',
    payroll_authorities: 'bg-sky-100 text-sky-800 border-sky-200',
    social_security: 'bg-blue-100 text-blue-800 border-blue-200',
    deductions: 'bg-blue-100 text-blue-800 border-blue-200',
    // P5 שנתי (ירוק)
    annual_reports: 'bg-green-100 text-green-800 border-green-200',
    personal_reports: 'bg-green-100 text-green-800 border-green-200',
    // P3 ניהול (ורוד)
    admin: 'bg-pink-100 text-pink-800 border-pink-200',
    office: 'bg-pink-100 text-pink-800 border-pink-200',
    // Legacy
    bookkeeping_full: 'bg-purple-100 text-purple-800 border-purple-200',
    masav_employees: 'bg-sky-100 text-sky-800 border-sky-200',
    masav_social: 'bg-sky-100 text-sky-800 border-sky-200',
    payslip_sending: 'bg-sky-100 text-sky-800 border-sky-200',
    authorities: 'bg-blue-100 text-blue-800 border-blue-200',
    authorities_payment: 'bg-blue-100 text-blue-800 border-blue-200',
};

// סדר מיון לפי קבוצות — 2 קבוצות ראשיות
const serviceGroupOrder = {
    // P2 הנה"ח (group 1)
    bookkeeping: 1, bookkeeping_production: 1, bookkeeping_reporting: 1, bookkeeping_closing: 1,
    reconciliation: 1, pnl_reports: 1, masav_suppliers: 1,
    vat: 1, vat_reporting: 1, tax_advances: 1, bookkeeping_full: 1,
    // P1 שכר (group 2)
    payroll: 2, payroll_ancillary: 2, payroll_authorities: 2,
    social_security: 2, deductions: 2,
    masav_employees: 2, masav_social: 2, payslip_sending: 2,
    authorities: 2, authorities_payment: 2,
    // P5 שנתי (group 3)
    annual_reports: 3, personal_reports: 3,
    // P3 ניהול (group 4)
    admin: 4, office: 4,
};

const statusUI = {
  active: { label: 'פעיל', icon: CheckCircle, color: 'text-green-600', badge: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'לא פעיל', icon: Clock, color: 'text-orange-600', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  potential: { label: 'פוטנציאלי', icon: Heart, color: 'text-gray-500', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
  former: { label: 'לקוח עבר', icon: Trash2, color: 'text-amber-600', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  onboarding_pending: { label: 'ממתין לקליטה', icon: UserCheck, color: 'text-purple-600', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  balance_sheet_only: { label: 'סגירת מאזן בלבד', icon: FileText, color: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

// ── Collapsible service group with steps ──
const serviceGroupLabels = {
  1: 'הנה"ח ודוחות',
  2: 'שכר',
  3: 'דוחות שנתיים',
  4: 'ניהול',
};

const serviceGroupIcons = {
  1: 'bg-emerald-800 border-emerald-600',   // ירוק יער עמוק
  2: 'bg-sky-700 border-sky-500',           // כחול
  3: 'bg-green-700 border-green-500',       // ירוק
  4: 'bg-pink-700 border-pink-500',         // ורוד
};

/**
 * ProcessTreeSection — reads from client.process_tree (new V4.x) with company tree labels/steps.
 * Falls back to ServiceTreeSection (old service_types[]) when process_tree is empty.
 */
function ProcessTreeSection({ processTree }) {
  const [expandedBranches, setExpandedBranches] = useState(new Set());
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [companyTree, setCompanyTree] = useState(null);

  useEffect(() => {
    loadCompanyTree().then(({ tree }) => {
      if (tree?.branches) setCompanyTree(tree);
    }).catch(() => {});
  }, []);

  if (!companyTree?.branches) return null;

  const clientTree = processTree || {};
  const enabledIds = getEnabledNodeIds(clientTree);
  if (enabledIds.length === 0) return null;

  // Branch group config
  const branchConfig = {
    P1: { label: 'שכר', bg: 'bg-sky-700', border: 'border-sky-300', count: 'bg-sky-500' },
    P2: { label: 'הנה"ח ודוחות', bg: 'bg-emerald-800', border: 'border-emerald-300', count: 'bg-emerald-600' },
    P3: { label: 'ניהול', bg: 'bg-amber-700', border: 'border-amber-300', count: 'bg-amber-500' },
    P5: { label: 'דוחות שנתיים', bg: 'bg-green-700', border: 'border-green-300', count: 'bg-green-500' },
  };

  // Collect enabled nodes per branch
  const branchGroups = {};
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    if (branchId === 'P4') continue;
    const flat = flattenTree({ branches: { [branchId]: branch } });
    const enabledInBranch = flat.filter(n => isNodeEnabled(clientTree, n.id));
    if (enabledInBranch.length > 0) {
      branchGroups[branchId] = enabledInBranch;
    }
  }

  if (Object.keys(branchGroups).length === 0) return null;

  return (
    <div className="border-t border-gray-100 pt-3 mt-2 space-y-1.5">
      {Object.entries(branchGroups).map(([branchId, nodes]) => {
        const config = branchConfig[branchId] || { label: branchId, bg: 'bg-gray-600', border: 'border-gray-300' };
        const isExpanded = expandedBranches.has(branchId);
        return (
          <div key={branchId} className="rounded-lg border border-gray-100 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedBranches(prev => { const n = new Set(prev); n.has(branchId) ? n.delete(branchId) : n.add(branchId); return n; }); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm ${config.bg} rounded-lg`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
              <span className="text-white font-black text-[15px] tracking-wide">{config.label}</span>
              <Badge className={`${config.count} text-white text-xs font-black px-2 py-0.5 border border-white/40 mr-auto rounded-full`}>
                {nodes.length}
              </Badge>
            </button>
            {isExpanded && (
              <div className="px-2 pb-1.5 space-y-0.5 bg-white">
                {nodes.map(node => {
                  const steps = node.steps || [];
                  const isNodeExpanded = expandedNodes.has(node.id);
                  const freq = clientTree[node.id]?.frequency;
                  const slaDay = node.sla_day;
                  return (
                    <div key={node.id} className={`mr-2 border-r-2 pr-2 ${config.border}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (steps.length > 0) setExpandedNodes(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; }); }}
                        className="w-full flex items-center gap-2 py-1 text-sm hover:text-gray-900"
                      >
                        {steps.length > 0 ? (
                          isNodeExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                        ) : <div className="w-3.5" />}
                        <span className="text-gray-700 font-medium">{node.label}</span>
                        {freq && (
                          <span className="text-[10px] text-gray-400 mr-1">
                            ({freq === 'monthly' ? 'חודשי' : freq === 'bimonthly' ? 'דו-חודשי' : freq})
                          </span>
                        )}
                        {slaDay && (
                          <span className="text-[10px] text-red-500 font-bold mr-1">SLA:{slaDay}</span>
                        )}
                        {steps.length > 0 && (
                          <span className="text-xs text-gray-400 mr-auto flex items-center gap-0.5">
                            <Layers className="w-3 h-3" /> {steps.length}
                          </span>
                        )}
                      </button>
                      {isNodeExpanded && steps.length > 0 && (
                        <div className="mr-4 pb-1 space-y-0.5">
                          {steps.map((step, idx) => (
                            <div key={step.key || idx} className="flex items-center gap-1.5 text-xs text-gray-600 py-0.5">
                              <Badge className="bg-amber-50 text-amber-600 text-[10px] px-1.5 py-0 border border-amber-200 font-bold">{idx + 1}</Badge>
                              <span>{step.label}</span>
                              {step.sla_day && <span className="text-red-400 text-[9px] font-bold">({step.sla_day})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Legacy fallback — reads from service_types[] + processTemplates */
function ServiceTreeSection({ services }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedServices, setExpandedServices] = useState(new Set());
  const [treeLabels, setTreeLabels] = useState(DEFAULT_SERVICE_LABELS);

  useEffect(() => {
    loadCompanyTree().then(({ tree }) => {
      if (!tree?.branches) return;
      const flat = flattenTree(tree);
      const labels = { ...DEFAULT_SERVICE_LABELS };
      for (const node of flat) {
        if (node.service_key) labels[node.service_key] = node.label;
      }
      setTreeLabels(labels);
    }).catch(() => {});
  }, []);

  const grouped = {};
  services.forEach(svc => {
    const group = serviceGroupOrder[svc] || 99;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(svc);
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(groupId) ? n.delete(groupId) : n.add(groupId); return n; });
  };
  const toggleService = (svcKey) => {
    setExpandedServices(prev => { const n = new Set(prev); n.has(svcKey) ? n.delete(svcKey) : n.add(svcKey); return n; });
  };

  return (
    <div className="border-t border-gray-100 pt-3 mt-2 space-y-1">
      {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([groupId, svcs]) => {
        const isGroupExpanded = expandedGroups.has(Number(groupId));
        const groupLabel = serviceGroupLabels[groupId] || `קבוצה ${groupId}`;
        const groupColor = serviceGroupIcons[groupId] || 'bg-gray-100 text-gray-700 border-gray-200';
        return (
          <div key={groupId} className="rounded-md border border-gray-100 overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); toggleGroup(Number(groupId)); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors rounded-lg ${groupColor}`}
            >
              {isGroupExpanded ? <ChevronDown className="w-4 h-4 shrink-0 text-white" /> : <ChevronLeft className="w-4 h-4 shrink-0 text-white" />}
              <span className="text-white font-black text-[15px] tracking-wide">{groupLabel}</span>
              <Badge className="bg-white/30 text-white text-xs font-black px-2 py-0.5 border border-white/40 mr-auto rounded-full">{svcs.length}</Badge>
            </button>
            {isGroupExpanded && (
              <div className="px-2 pb-1.5 space-y-0.5">
                {svcs.map(svcKey => {
                  const svcTemplate = ALL_SERVICES[svcKey];
                  const steps = svcTemplate?.steps || [];
                  const isServiceExpanded = expandedServices.has(svcKey);
                  return (
                    <div key={svcKey} className="mr-2 border-r-2 pr-2 border-gray-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (steps.length > 0) toggleService(svcKey); }}
                        className="w-full flex items-center gap-2 py-1 text-sm hover:text-gray-900"
                      >
                        {steps.length > 0 ? (isServiceExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />) : <div className="w-3.5" />}
                        <span className="text-gray-700 font-medium">{treeLabels[svcKey] || svcKey.replace(/_/g, ' ')}</span>
                        {steps.length > 0 && <span className="text-xs text-gray-400 mr-auto flex items-center gap-0.5"><Layers className="w-3 h-3" />{steps.length}</span>}
                      </button>
                      {isServiceExpanded && steps.length > 0 && (
                        <div className="mr-4 pb-1 space-y-0.5">
                          {steps.map((step, idx) => (
                            <div key={step.key} className="flex items-center gap-1.5 text-xs text-gray-600 py-0.5">
                              <Badge className="bg-amber-50 text-amber-600 text-[10px] px-1.5 py-0 border border-amber-200 font-bold">{idx + 1}</Badge>
                              <span>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ClientCard({ client, isSelected, onToggleSelect, onEdit, onSelectAccounts, onSelectCollections, onSelectContracts, onDelete, onSelectTasks, onSelectFiles }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [accountsSummary, setAccountsSummary] = useState(null);
  const [accountantName, setAccountantName] = useState(null);
  const [showTaxInfo, setShowTaxInfo] = useState(false);

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
  const pt = client.process_tree || {};

  const frequencyLabels = {
    monthly: 'חודשי',
    bimonthly: 'דו-חודשי',
    quarterly: 'רבעוני',
    semi_annual: 'חצי שנתי',
    check_needed: 'לבדיקה',
    not_applicable: 'לא רלוונטי',
  };

  // Resolve frequency: process_tree overrides → reporting_info fallback
  const resolveFreq = (nodeId, reportingKey) => {
    // 1. Check process_tree node override
    if (pt[nodeId]?.frequency) return pt[nodeId].frequency;
    // 2. Fallback to reporting_info
    return reportingInfo[reportingKey] || null;
  };

  // Row 1: מע"מ ומקדמות
  const reportingRow1 = [
    { nodeId: 'P2_vat', key: 'vat_reporting_frequency', label: 'מע"מ' },
    { nodeId: 'P2_tax_advances', key: 'tax_advances_frequency', label: 'מקדמות' },
  ].map(f => ({ ...f, value: resolveFreq(f.nodeId, f.key) }))
   .filter(f => f.value && f.value !== 'not_applicable');

  // Row 2: שכר, ב"ל וניכויים (ללקוחות עם שכר)
  const reportingRow2 = [
    { nodeId: 'P1_payroll', key: 'payroll_frequency', label: 'שכר' },
    { nodeId: 'P1_social_security', key: 'social_security_frequency', label: 'ב"ל' },
    { nodeId: 'P1_deductions', key: 'deductions_frequency', label: 'ניכויים' },
  ].map(f => ({ ...f, value: resolveFreq(f.nodeId, f.key) }))
   .filter(f => f.value && f.value !== 'not_applicable');

  const hasReporting = reportingRow1.length > 0 || reportingRow2.length > 0;

  return (
    <Card className={`w-full transition-all duration-300 flex flex-col group rounded-2xl ${isSelected ? 'border-[3px] border-blue-400 ring-2 ring-blue-100 bg-gradient-to-br from-blue-50/60 to-white shadow-lg shadow-blue-100/50' : 'border-[3px] border-gray-200 bg-white shadow-sm hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1'}`}>
      <CardHeader className="pb-3 flex-shrink-0 bg-gradient-to-l from-emerald-50/30 via-sky-50/20 to-white rounded-t-2xl border-b border-gray-100">
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

              <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-900 group-hover:text-emerald-600 transition-colors leading-tight min-w-0 flex-1">
                <Building className="w-5 h-5 text-gray-600 flex-shrink-0" />
                <span className="truncate">{client.name}</span>
              </CardTitle>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={`${uiProps.badge} text-sm font-bold flex-shrink-0 flex items-center gap-1.5 border px-3 py-1`}>
                  <StatusIcon className={`w-4 h-4 ${uiProps.color}`} />
                  {uiProps.label}
              </Badge>
              {relatedTasks.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 text-sm font-semibold px-2.5 py-0.5">
                  {relatedTasks.length} משימות
                </Badge>
              )}
            </div>
        </div>
        {mainContact?.name && (
          <p className="text-base text-gray-700 flex items-center gap-2 mt-1 truncate font-medium">
            <User className="w-4 h-4 flex-shrink-0" />
            <span>{mainContact.name}</span>
          </p>
        )}
      </CardHeader>
      
      <CardContent className="py-3 flex-grow overflow-y-auto">
        {(mainContact?.phone || mainContact?.email) && (
          <div className="space-y-2 mb-3">
            {mainContact.phone && (
              <a href={`tel:${mainContact.phone}`} className="flex items-center gap-2 text-base text-gray-700 hover:text-emerald-700 transition-colors font-medium">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{mainContact.phone}</span>
              </a>
            )}
            {mainContact.email && (
              <a href={`mailto:${mainContact.email}`} className="flex items-center gap-2 text-base text-gray-700 hover:text-emerald-700 transition-colors">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{mainContact.email}</span>
              </a>
            )}
          </div>
        )}
        
        {/* רו"ח */}
        {accountantName && (
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2 pb-2 border-b border-gray-100">
            <BookUser className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="font-bold text-indigo-700">רו"ח:</span>
            <span className="font-medium">{accountantName}</span>
          </div>
        )}

        {/* תדירויות דיווח - שורה 1: מע"מ ומקדמות, שורה 2: שכר ב"ל וניכויים */}
        {hasReporting && (
          <div className="border-t border-gray-100 pt-2 min-h-[3rem]">
            {reportingRow1.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                {reportingRow1.map(f => (
                  <span key={f.key} className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-bold">{f.label}:</span>
                    <span className={f.value === 'bimonthly' ? 'text-amber-600 font-bold' : 'font-medium'}>
                      {frequencyLabels[f.value] || f.value}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {reportingRow2.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 mt-1">
                {reportingRow2.map(f => (
                  <span key={f.key} className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-bold">{f.label}:</span>
                    <span className={f.value === 'bimonthly' ? 'text-amber-600 font-bold' : 'font-medium'}>
                      {frequencyLabels[f.value] || f.value}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* שירותים — מעץ תהליכים (V4.x) או fallback לשירותים ישנים */}
        {client.process_tree && Object.keys(client.process_tree).length > 0 ? (
          <ProcessTreeSection processTree={client.process_tree} />
        ) : services.length > 0 ? (
          <ServiceTreeSection services={services} />
        ) : null}

        {/* Tax IDs - quick reference */}
        {(() => {
          // Smart logic: don't show "חסר" for clients using הו"ק (automatic standing order)
          const hasPayroll = client.service_types?.includes('payroll') || client.process_tree?.P1_payroll?.enabled;
          const hasTaxAdvances = client.service_types?.includes('tax_advances') || client.process_tree?.P2_tax_advances?.enabled;
          const hasDeductions = client.process_tree?.P1_deductions?.enabled;
          // Check if payment is automatic (הו"ק) — these clients don't need manual tax IDs
          const deductionsPayment = client.process_tree?.P1_deductions?.extra_fields?.payment_method
            || client.process_tree?.P1_deductions?.payment_method;
          const advancesPayment = client.process_tree?.P2_tax_advances?.extra_fields?.payment_method
            || client.process_tree?.P2_tax_advances?.payment_method;
          const isAutoDeductionPayment = deductionsPayment === 'bank_standing_order';
          const isAutoAdvancesPayment = advancesPayment === 'bank_standing_order';
          // Only show deductions ID if client has the service AND payment isn't automatic
          const showDeductionsId = hasPayroll && hasDeductions && !isAutoDeductionPayment;
          const showAdvancesId = hasTaxAdvances && !isAutoAdvancesPayment;

          return (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                <span>
                  <span className="font-bold text-gray-800">ח"פ:</span>{' '}
                  {client.entity_number || <span className="text-red-500 text-xs font-bold">חסר</span>}
                </span>
                <span>
                  <span className="font-bold text-gray-800">תיק ניכויים:</span>{' '}
                  {client.tax_info?.tax_deduction_file_number || <span className="text-red-500 text-xs font-bold">חסר</span>}
                </span>
                {showDeductionsId && (
                  <span>
                    <span className="font-bold text-gray-800">מזהה ניכויים:</span>{' '}
                    {client.tax_info?.annual_tax_ids?.deductions_id || <span className="text-red-500 text-xs font-bold">חסר</span>}
                  </span>
                )}
                {showAdvancesId && (
                  <span>
                    <span className="font-bold text-gray-800">מזהה מקדמות:</span>{' '}
                    {client.tax_info?.annual_tax_ids?.tax_advances_id || <span className="text-red-500 text-xs font-bold">חסר</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bank accounts summary */}
        {accountsSummary && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {accountsSummary.banks > 0 && (
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-blue-500" />
                  {accountsSummary.banks} חשבונות בנק
                </span>
              )}
              {accountsSummary.cards > 0 && (
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  {accountsSummary.cards} כרט' אשראי
                </span>
              )}
              {accountsSummary.other > 0 && (
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-gray-500" />
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
            {client.integration_info?.calmplan_id && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <h5 className="text-xs font-medium text-gray-600 mb-1">פרטי מערכת</h5>
                <div className="space-y-1 text-xs text-gray-500">
                  {client.integration_info?.calmplan_id && (
                    <div>CalmPlan ID: {client.integration_info.calmplan_id}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="grid grid-cols-4 gap-1.5 p-2.5 border-t-2 border-gray-100 bg-gradient-to-l from-gray-50/80 to-white rounded-b-2xl flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
            <Edit className="w-4 h-4 ml-1" />
            עריכה
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectTasks(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
            <CheckSquare className="w-4 h-4 ml-1" />
            משימות
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectFiles?.(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
            <FolderOpen className="w-4 h-4 ml-1" />
            קבצים
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTaxInfo(true)} className="h-9 text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700">
            <Receipt className="w-4 h-4 ml-1" />
            פרטי מס
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectAccounts(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
            <Building className="w-4 h-4 ml-1" />
            חשבונות
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectCollections(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
              <DollarSign className="w-4 h-4 ml-1" />
              גבייה
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onSelectContracts(client)} className="h-9 text-sm font-medium text-gray-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm">
              <FileText className="w-4 h-4 ml-1" />
              חוזים
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-9 text-sm font-medium text-red-500 hover:bg-rose-100 hover:text-red-600">
              <Trash2 className="w-4 h-4 ml-1" />
              מחיקה
          </Button>
      </CardFooter>
      <TaxInfoDialog client={client} open={showTaxInfo} onClose={() => setShowTaxInfo(false)} />
    </Card>
  );
}
