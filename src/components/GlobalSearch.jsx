import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command';
import {
  CheckSquare, Users, FolderKanban, StickyNote, Search,
  ArrowLeft, Plus, UserCheck, FileBarChart, Calculator, Eye, Zap,
  Network, Home as HomeIcon,
} from 'lucide-react';
import { Task, Client, Project, StickyNote as StickyNoteEntity, ServiceProvider } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { ALL_SERVICES } from '@/config/processTemplates';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

const ENTITY_CONFIGS = [
  {
    key: 'clients',
    label: 'לקוחות',
    icon: Users,
    color: 'text-emerald-600',
    entity: Client,
    searchFields: ['name', 'entity_number', 'contact_person', 'email', 'phone'],
    // Deep search: also check nested tax_info, reporting_info, contacts, process_tree fields
    deepSearch: (item, q) => {
      // tax_info fields (תיק ניכויים, תיק מע"מ, תיק ביטוח לאומי, etc.)
      const ti = item.tax_info || {};
      const annualIds = ti.annual_tax_ids || {};
      const prevIds = ti.prev_year_ids || {};
      const taxFields = [
        ti.tax_id, ti.vat_file_number, ti.tax_deduction_file_number,
        ti.social_security_file_number, ti.income_tax_file_number,
        annualIds.social_security_id, annualIds.deductions_id,
        annualIds.tax_advances_id, annualIds.tax_advances_percentage,
        prevIds.social_security_id, prevIds.deductions_id,
        prevIds.tax_advances_id, prevIds.tax_advances_percentage,
      ];
      if (taxFields.some(v => v && String(v).toLowerCase().includes(q))) return true;
      // reporting_info
      const ri = item.reporting_info || {};
      if (Object.values(ri).some(v => v && String(v).toLowerCase().includes(q))) return true;
      // contacts array
      const contacts = item.contacts || [];
      if (contacts.some(c => [c.name, c.email, c.phone, c.role].some(v => v && String(v).toLowerCase().includes(q)))) return true;
      // notes
      if (item.notes && String(item.notes).toLowerCase().includes(q)) return true;
      // shareholders (בעלי מניות)
      const shareholders = item.shareholders || [];
      if (shareholders.some(sh => [sh.name, sh.id_number, sh.phone, sh.email, sh.license_number, sh.role].some(v => v && String(v).toLowerCase().includes(q)))) return true;
      return false;
    },
    getUrl: (item) => `${createPageUrl('ClientManagement')}?clientId=${item.id}`,
    getSubtitle: (item) => {
      const parts = [item.entity_number, item.contact_person, item.email].filter(Boolean);
      const ti = item.tax_info || {};
      if (ti.tax_deduction_file_number) parts.push(`ניכויים: ${ti.tax_deduction_file_number}`);
      if (ti.vat_file_number) parts.push(`מע"מ: ${ti.vat_file_number}`);
      if (ti.social_security_file_number) parts.push(`ב"ל: ${ti.social_security_file_number}`);
      return parts.slice(0, 4).join(' | ');
    },
  },
  {
    key: 'tasks',
    label: 'משימות',
    icon: CheckSquare,
    color: 'text-blue-600',
    entity: Task,
    searchFields: ['title', 'description', 'client_name', 'category', 'branch'],
    getUrl: (item) => {
      // Feature 8: Deep-link to task's client drawer in MindMap
      const params = new URLSearchParams({ view: 'mindmap' });
      if (item.id) params.set('taskId', item.id);
      if (item.client_name) params.set('clientName', item.client_name);
      return `${createPageUrl('Tasks')}?${params.toString()}`;
    },
    getSubtitle: (item) => [item.client_name, resolveCategoryLabel(item.category), item.branch, item.status === 'production_completed' ? 'הושלם ייצור' : item.status === 'not_started' ? 'טרם התחיל' : ''].filter(Boolean).join(' | '),
  },
  {
    key: 'projects',
    label: 'פרויקטים',
    icon: FolderKanban,
    color: 'text-purple-600',
    entity: Project,
    searchFields: ['title', 'description', 'client_name'],
    getUrl: () => createPageUrl('Projects'),
    getSubtitle: (item) => [item.client_name, item.status].filter(Boolean).join(' | '),
  },
  {
    key: 'notes',
    label: 'פתקים',
    icon: StickyNote,
    color: 'text-amber-600',
    entity: StickyNoteEntity,
    searchFields: ['title', 'content'],
    getUrl: () => createPageUrl('Home'),
    getSubtitle: (item) => item.content?.substring(0, 60) || '',
  },
  {
    key: 'providers',
    label: 'ספקי שירות',
    icon: Users,
    color: 'text-teal-600',
    entity: ServiceProvider,
    searchFields: ['name', 'contact_person', 'phone', 'email', 'service_type', 'notes'],
    getUrl: () => createPageUrl('ServiceProviders'),
    getSubtitle: (item) => [item.service_type, item.contact_person, item.phone].filter(Boolean).join(' | '),
  },
];

// Sidebar menu items for search
const MENU_ITEMS = [
  { label: 'מה לעשות היום', url: createPageUrl('Home'), keywords: 'היום עכשיו פוקוס' },
  { label: 'התמונה המלאה', url: createPageUrl('MyFocus'), keywords: 'מיקוד תמונה מלאה' },
  { label: 'תכנון שבועי', url: createPageUrl('WeeklyPlanningDashboard'), keywords: 'שבוע תכנון שבועי' },
  { label: 'לוח שנה', url: createPageUrl('Calendar'), keywords: 'לוח שנה אירועים' },
  { label: 'כל המשימות', url: createPageUrl('Tasks'), keywords: 'משימות רשימה' },
  { label: 'שלב ייצור ואישור', url: createPageUrl('PayrollDashboard'), keywords: 'שכר ייצור תלושים' },
  { label: 'דיווחים שוטפים 102', url: createPageUrl('PayrollReportsDashboard'), keywords: '102 ביטוח לאומי ניכויים' },
  { label: 'דיווחי מיסים', url: createPageUrl('TaxReportsDashboard'), keywords: 'מעמ מקדמות מיסים' },
  { label: 'התאמות חשבונות', url: createPageUrl('Reconciliations'), keywords: 'התאמות בנק אשראי' },
  { label: 'מאזנים ודוחות', url: createPageUrl('BalanceSheets'), keywords: 'מאזן דוח שנתי' },
  { label: 'מרכז לקוחות', url: createPageUrl('ClientManagement'), keywords: 'לקוחות ניהול' },
  { label: 'פרוייקטים', url: createPageUrl('Projects'), keywords: 'פרויקט פיתוח' },
  { label: 'הגדרות מערכת', url: createPageUrl('Settings'), keywords: 'הגדרות תהליכים' },
  { label: 'משימות חוזרות', url: createPageUrl('RecurringTasks'), keywords: 'הזרקה חוזרות דדליין' },
  { label: 'ספקי שירות', url: createPageUrl('ServiceProviders'), keywords: 'ספק רואה חשבון מתפעל' },
  { label: 'תכנון ארוחות', url: createPageUrl('MealPlanner'), keywords: 'ארוחות בישול' },
  { label: 'גיבויים', url: createPageUrl('BackupManager'), keywords: 'גיבוי שחזור' },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [allData, setAllData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Service Catalog index (static — from processTemplates DNA) ──
  const serviceIndex = useMemo(() => {
    return Object.entries(ALL_SERVICES).map(([key, svc]) => ({
      id: key,
      key,
      label: svc.label,
      dashboard: svc.dashboard,
      branch: svc.branch || (svc.dashboard === 'payroll' ? 'P1' : svc.dashboard === 'home' ? 'P4' : svc.dashboard === 'annual_reports' ? 'P5' : 'P2'),
      categories: (svc.taskCategories || []).join(' '),
      stepLabels: (svc.steps || []).map(s => s.label).join(' '),
    }));
  }, []);

  // Determine current page for context-aware boosting
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path.includes('TaxReportsDashboard')) return 'TaxReportsDashboard';
    if (path.includes('PayrollDashboard')) return 'PayrollDashboard';
    if (path.includes('ClientsDashboard')) return 'ClientsDashboard';
    return '';
  };

  // Quick Actions
  const QUICK_ACTIONS = [
    {
      key: 'new_task',
      label: 'משימה חדשה',
      icon: Plus,
      color: 'text-emerald-600',
      keywords: ['משימה חדשה', 'צור משימה', 'הוסף משימה', 'new task'],
      action: () => navigate(createPageUrl('Tasks')),
    },
    {
      key: 'new_client',
      label: 'קליטת לקוח חדש',
      icon: UserCheck,
      color: 'text-blue-600',
      keywords: ['לקוח חדש', 'קליטה', 'onboarding'],
      action: () => navigate(createPageUrl('ClientOnboarding')),
    },
    {
      key: 'vat_report',
      label: 'דיווח מע"מ',
      icon: FileBarChart,
      color: 'text-violet-600',
      keywords: ['מעמ', 'vat', 'דיווח מע"מ', 'מע"מ'],
      action: () => navigate(createPageUrl('TaxReportsDashboard')),
    },
    {
      key: 'payroll',
      label: 'שכר ודיווחי רשויות',
      icon: Calculator,
      color: 'text-orange-600',
      keywords: ['שכר', 'payroll', 'תלוש'],
      action: () => navigate(createPageUrl('PayrollDashboard')),
    },
    {
      key: 'focus',
      label: 'מה לעשות היום',
      icon: Eye,
      color: 'text-sky-600',
      keywords: ['ריכוז', 'פוקוס', 'focus', 'יומי', 'מה לעשות'],
      action: () => navigate(createPageUrl('Home')),
    },
    {
      key: 'meal_planner',
      label: 'תכנון ארוחות',
      icon: HomeIcon,
      color: 'text-amber-600',
      keywords: ['ארוחות', 'תכנון ארוחות', 'meals', 'בישול', 'אוכל'],
      action: () => navigate(createPageUrl('MealPlanner')),
    },
    {
      key: 'recurring_tasks',
      label: 'הזרקת משימות חוזרות',
      icon: Zap,
      color: 'text-violet-600',
      keywords: ['הזרקה', 'inject', 'חוזרות', 'recurring', 'פברואר', 'מרץ'],
      action: () => navigate(createPageUrl('RecurringTasks')),
    },
  ];

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({});
      return;
    }

    const loadAll = async () => {
      setIsLoading(true);
      const data = {};
      await Promise.all(
        ENTITY_CONFIGS.map(async (config) => {
          try {
            const items = await config.entity.list(null, 500);
            data[config.key] = items || [];
          } catch {
            data[config.key] = [];
          }
        })
      );
      setAllData(data);
      setIsLoading(false);
    };
    loadAll();
  }, [open]);

  // Filter results with context-aware boosting
  useEffect(() => {
    if (!query.trim()) {
      setResults({});
      return;
    }

    const q = query.trim().toLowerCase();
    const currentPage = getCurrentPage();
    const filtered = {};

    for (const config of ENTITY_CONFIGS) {
      const items = allData[config.key] || [];
      let matches = items.filter(item => {
        // Standard top-level field search
        const topMatch = config.searchFields.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(q);
        });
        if (topMatch) return true;
        // Deep nested field search (for clients: tax_info, contacts, etc.)
        if (config.deepSearch) return config.deepSearch(item, q);
        return false;
      });

      // Context boosting
      if (currentPage === 'TaxReportsDashboard' && config.key === 'tasks') {
        matches.sort((a, b) => {
          const aIsTax = ['מע"מ', 'מקדמות מס'].includes(a.category) ? -1 : 0;
          const bIsTax = ['מע"מ', 'מקדמות מס'].includes(b.category) ? -1 : 0;
          return aIsTax - bIsTax;
        });
      } else if (currentPage === 'PayrollDashboard' && config.key === 'tasks') {
        matches.sort((a, b) => {
          const aIsPayroll = ['שכר', 'ביטוח לאומי', 'ניכויים'].includes(a.category) ? -1 : 0;
          const bIsPayroll = ['שכר', 'ביטוח לאומי', 'ניכויים'].includes(b.category) ? -1 : 0;
          return aIsPayroll - bIsPayroll;
        });
      }

      matches = matches.slice(0, 5);
      if (matches.length > 0) {
        filtered[config.key] = matches;
      }
    }

    // Match Quick Actions
    const matchingActions = QUICK_ACTIONS.filter(a =>
      a.keywords.some(kw => kw.includes(q) || q.includes(kw))
    );
    if (matchingActions.length > 0) filtered['actions'] = matchingActions;

    // ── Menu items search ──
    const menuMatches = MENU_ITEMS.filter(m =>
      m.label.toLowerCase().includes(q) || m.keywords.toLowerCase().includes(q)
    );
    if (menuMatches.length > 0) filtered['menu'] = menuMatches;

    // ── Service Catalog search ──
    const serviceMatches = serviceIndex.filter(svc =>
      svc.label.toLowerCase().includes(q) ||
      svc.key.toLowerCase().includes(q) ||
      svc.categories.toLowerCase().includes(q) ||
      svc.stepLabels.toLowerCase().includes(q) ||
      svc.branch.toLowerCase().includes(q) ||
      (svc.dashboard || '').toLowerCase().includes(q)
    ).slice(0, 6);
    if (serviceMatches.length > 0) filtered['services'] = serviceMatches;

    setResults(filtered);
  }, [query, allData, serviceIndex]);

  const handleSelect = useCallback((config, item) => {
    const url = config.getUrl(item);
    if (url) {
      navigate(url);
    }
    setOpen(false);
  }, [navigate]);

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground rounded-2xl border border-gray-200/60 transition-all hover:shadow-md hover:border-sky-200"
        style={{ background: 'linear-gradient(135deg, #F8FAFF, #FFFFFF)', boxShadow: '0 1px 4px rgba(0,163,224,0.06)' }}
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-right">חיפוש או ביצוע פעולה...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded-full border border-[#E0E0E0] bg-white px-1.5 py-0.5 text-[12px] font-mono text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      {/* Command palette dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="חפש לקוחות, משימות, שירותים (P1-P5), פתקים או הקלד פעולה..."
          value={query}
          onValueChange={setQuery}
          dir="rtl"
        />
        <CommandList dir="rtl">
          {isLoading && (
            <div className="py-6 text-center text-sm text-gray-400">טוען נתונים...</div>
          )}

          {!isLoading && query.trim() && totalResults === 0 && (
            <CommandEmpty>לא נמצאו תוצאות עבור &quot;{query}&quot;</CommandEmpty>
          )}

          {!isLoading && !query.trim() && (
            <div className="py-6 text-center text-sm text-gray-400">
              הקלד לחיפוש בכל המערכת
            </div>
          )}

          {/* Quick Actions */}
          {!isLoading && results.actions && (
            <CommandGroup heading={
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                פעולות מהירות
              </span>
            }>
              {results.actions.map(action => {
                const ActionIcon = action.icon;
                return (
                  <CommandItem key={action.key} onSelect={() => { action.action(); setOpen(false); }}
                    className="flex items-center gap-2 cursor-pointer">
                    <ActionIcon className={`w-4 h-4 ${action.color} shrink-0`} />
                    <span className="text-sm font-medium">{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Entity results */}
          {!isLoading && ENTITY_CONFIGS.map((config) => {
            const items = results[config.key];
            if (!items || items.length === 0) return null;
            const Icon = config.icon;
            return (
              <CommandGroup key={config.key} heading={
                <span className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  {config.label}
                  <span className="text-gray-400 font-normal">({items.length})</span>
                </span>
              }>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${config.key}-${item.id}-${item.title || item.name}`}
                    onSelect={() => handleSelect(config, item)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title || item.name}</div>
                      {config.getSubtitle(item) && (
                        <div className="text-[11px] text-gray-400 truncate">{config.getSubtitle(item)}</div>
                      )}
                    </div>
                    {config.getUrl(item) && (
                      <ArrowLeft className="w-3 h-3 text-gray-300 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {/* Service Catalog results */}
          {!isLoading && results.services && results.services.length > 0 && (
            <CommandGroup heading={
              <span className="flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-violet-600" />
                שירותים (קטלוג P1-P5)
                <span className="text-gray-400 font-normal">({results.services.length})</span>
              </span>
            }>
              {results.services.map((svc) => (
                <CommandItem
                  key={svc.id}
                  value={`service-${svc.id}-${svc.label}`}
                  onSelect={() => {
                    // Navigate to the service's dashboard page, not just Settings
                    const dashboardMap = {
                      payroll: 'PayrollDashboard',
                      tax: 'TaxReportsDashboard',
                      reconciliation: 'Reconciliations',
                      additional: 'AdditionalServicesDashboard',
                      annual_reports: 'BalanceSheets',
                      admin: 'Settings',
                      home: 'LifeSettings',
                    };
                    const targetPage = dashboardMap[svc.dashboard] || 'Settings';
                    navigate(createPageUrl(targetPage));
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Network className="w-4 h-4 text-violet-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{svc.label}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {svc.branch} | {svc.dashboard} | {svc.key}
                    </div>
                  </div>
                  <ArrowLeft className="w-3 h-3 text-gray-300 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Menu / Pages results */}
          {!isLoading && results.menu && results.menu.length > 0 && (
            <CommandGroup heading={
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                עמודים ותפריטים
                <span className="text-gray-400 font-normal">({results.menu.length})</span>
              </span>
            }>
              {results.menu.map((m) => (
                <CommandItem
                  key={m.url}
                  value={`menu-${m.label}`}
                  onSelect={() => { navigate(m.url); setOpen(false); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-sm">{m.label}</span>
                  <ArrowLeft className="w-3 h-3 text-gray-300 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
