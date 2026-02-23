import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command';
import {
  CheckSquare, Users, FolderKanban, StickyNote, Search,
  ArrowLeft, Plus, UserCheck, FileBarChart, Calculator, Eye, Zap,
} from 'lucide-react';
import { Task, Client, Project, StickyNote as StickyNoteEntity } from '@/api/entities';
import { createPageUrl } from '@/utils';

const ENTITY_CONFIGS = [
  {
    key: 'clients',
    label: 'לקוחות',
    icon: Users,
    color: 'text-emerald-600',
    entity: Client,
    searchFields: ['name', 'entity_number', 'contact_person', 'email', 'phone'],
    getUrl: (item) => `${createPageUrl('ClientManagement')}?clientId=${item.id}`,
    getSubtitle: (item) => [item.entity_number, item.contact_person, item.email].filter(Boolean).join(' | '),
  },
  {
    key: 'tasks',
    label: 'משימות',
    icon: CheckSquare,
    color: 'text-blue-600',
    entity: Task,
    searchFields: ['title', 'description', 'client_name'],
    getUrl: (item) => {
      // Feature 8: Deep-link to task's client drawer in MindMap
      const params = new URLSearchParams({ view: 'mindmap' });
      if (item.id) params.set('taskId', item.id);
      if (item.client_name) params.set('clientName', item.client_name);
      return `${createPageUrl('Tasks')}?${params.toString()}`;
    },
    getSubtitle: (item) => [item.client_name, item.category, item.status === 'completed' ? 'הושלם' : item.status === 'in_progress' ? 'בעבודה' : ''].filter(Boolean).join(' | '),
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
    getUrl: () => null,
    getSubtitle: (item) => item.content?.substring(0, 60) || '',
  },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [allData, setAllData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
      label: 'פוקוס יומי',
      icon: Eye,
      color: 'text-sky-600',
      keywords: ['ריכוז', 'פוקוס', 'focus', 'יומי'],
      action: () => navigate(createPageUrl('Home')),
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
      let matches = items.filter(item =>
        config.searchFields.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(q);
        })
      );

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

    setResults(filtered);
  }, [query, allData]);

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
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-white/40 hover:bg-white/60 rounded-[32px] border border-white/20 backdrop-blur-sm transition-all"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-right">חיפוש או ביצוע פעולה...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded-full border border-white/30 bg-white/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      {/* Command palette dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="חפש לקוחות, משימות, פרויקטים או הקלד פעולה..."
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
        </CommandList>
      </CommandDialog>
    </>
  );
}
