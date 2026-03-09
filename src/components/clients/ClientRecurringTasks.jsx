import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  RefreshCw, CheckCircle, AlertTriangle, Calendar, Plus,
  Clock, FileText, Calculator, Building, Trash2,
  ChevronDown, ChevronRight, Sparkles, Eye, EyeOff, Zap, XCircle
} from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { format, addMonths, setDate, startOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { getDueDateForCategory, isClient874, getDeadlineTypeLabel, HEBREW_MONTH_NAMES } from '@/config/taxCalendar2026';
import { getScheduledStartForCategory } from '@/config/automationRules';

// ============================================================
// P-Branch definitions: P1 = Payroll, P2 = Bookkeeping/Tax
// ============================================================
const P_BRANCHES = {
  P1: {
    key: 'P1',
    label: 'P1 | חשבות שכר',
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    order: 1,
    categories: ['שכר', 'ביטוח לאומי', 'ניכויים'],
  },
  P2: {
    key: 'P2',
    label: 'P2 | הנהלת חשבונות',
    color: 'bg-purple-100 text-purple-800',
    accent: 'border-purple-400',
    bgSoft: 'bg-purple-50',
    dot: 'bg-purple-500',
    order: 2,
    categories: ['מע"מ', 'מקדמות מס', 'דוח רו"ה'],
  },
};

// ============================================================
// Category definitions with branch assignment
// ============================================================
/**
 * REPORT_CATEGORIES — Service-aware task generation.
 * ZERO GHOST DATA: Only services that exist in client.service_types[] generate tasks.
 * Each category is assigned to a P-branch for hierarchical tagging.
 *
 * Filtering rules:
 *   - ביטוח לאומי: ONLY if client.service_types includes 'social_security'
 *   - ניכויים: ONLY if client.service_types includes 'deductions'
 *   - דוח רו"ה: ONLY if client.service_types includes 'pnl_reports'
 *   - Frequency is checked per-category via reporting_info[frequencyField]
 */
const REPORT_CATEGORIES = {
  'שכר': {
    label: 'שכר',
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeKey: 'payroll',
    dayOfMonth: 15,
    order: 1,
    branch: 'P1',
  },
  'ביטוח לאומי': {
    label: 'סוציאליות',
    icon: Building,
    color: 'bg-rose-100 text-rose-800',
    accent: 'border-rose-400',
    bgSoft: 'bg-rose-50',
    dot: 'bg-rose-500',
    frequencyField: 'social_security_frequency',
    serviceTypeKey: 'social_security',
    // Fallback: if no dedicated frequency, inherit from payroll
    fallbackFrequencyField: 'payroll_frequency',
    dayOfMonth: 15,
    order: 2,
    branch: 'P1',
  },
  'ניכויים': {
    label: 'ניכויים',
    icon: FileText,
    color: 'bg-amber-100 text-amber-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    frequencyField: 'deductions_frequency',
    serviceTypeKey: 'deductions',
    // Fallback: if no dedicated frequency, inherit from payroll
    fallbackFrequencyField: 'payroll_frequency',
    dayOfMonth: 19,
    order: 3,
    branch: 'P1',
  },
  'מע"מ': {
    label: 'מע"מ',
    icon: Calculator,
    color: 'bg-purple-100 text-purple-800',
    accent: 'border-purple-400',
    bgSoft: 'bg-purple-50',
    dot: 'bg-purple-500',
    frequencyField: 'vat_reporting_frequency',
    serviceTypeKey: 'vat_reporting',
    dayOfMonth: 15,
    order: 4,
    branch: 'P2',
  },
  'מקדמות מס': {
    label: 'מקדמות מס',
    icon: Building,
    color: 'bg-teal-100 text-teal-800',
    accent: 'border-teal-400',
    bgSoft: 'bg-teal-50',
    dot: 'bg-teal-500',
    frequencyField: 'tax_advances_frequency',
    serviceTypeKey: 'tax_advances',
    dayOfMonth: 15,
    order: 5,
    branch: 'P2',
  },
  'דוח רו"ה': {
    label: 'דוח רו"ה חודשי',
    icon: FileText,
    color: 'bg-indigo-100 text-indigo-800',
    accent: 'border-indigo-400',
    bgSoft: 'bg-indigo-50',
    dot: 'bg-indigo-500',
    frequencyField: 'pnl_frequency',
    serviceTypeKey: 'pnl_reports',
    dayOfMonth: 15,
    order: 6,
    branch: 'P2',
  },
};

const BIMONTHLY_PERIOD_NAMES = {
  2: 'ינואר-פברואר',
  4: 'מרץ-אפריל',
  6: 'מאי-יוני',
  8: 'יולי-אוגוסט',
  10: 'ספטמבר-אוקטובר',
  12: 'נובמבר-דצמבר',
};

const QUARTERLY_PERIOD_NAMES = {
  3: 'ינואר-מרץ (Q1)',
  6: 'אפריל-יוני (Q2)',
  9: 'יולי-ספטמבר (Q3)',
  12: 'אוקטובר-דצמבר (Q4)',
};

const FREQUENCY_LABELS = {
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semi_annual: 'חצי שנתי',
};

function getClientFrequency(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return 'monthly';
  const reporting = client.reporting_info || {};
  // Try primary frequency field first
  const field = cat.frequencyField;
  if (field) {
    const freq = reporting[field];
    if (freq && freq !== 'not_applicable') return freq;
  }
  // Fallback frequency field (e.g., social_security inherits from payroll)
  if (cat.fallbackFrequencyField) {
    const fallback = reporting[cat.fallbackFrequencyField];
    if (fallback && fallback !== 'not_applicable') return fallback;
  }
  return 'monthly';
}

/**
 * Expand 'full_service' into its constituent services.
 * full_service = vat_reporting + payroll + tax_advances + annual_reports
 * Payroll auto-links: payroll → social_security + deductions (via automation rules)
 */
const FULL_SERVICE_EXPANSION = ['vat_reporting', 'payroll', 'tax_advances', 'annual_reports', 'social_security', 'deductions'];

function getExpandedServices(client) {
  const raw = client.service_types || [];
  const expanded = new Set(raw);
  if (expanded.has('full_service')) {
    for (const s of FULL_SERVICE_EXPANSION) expanded.add(s);
  }
  return expanded;
}

/**
 * STRICT service check — ZERO GHOST DATA.
 * Returns true ONLY if client has the exact service key in service_types[],
 * with full_service expansion applied.
 * Also checks that the frequency is active (not 'not_applicable').
 */
function clientHasService(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return false;
  const services = getExpandedServices(client);
  if (!services.has(cat.serviceTypeKey)) return false;
  // Also verify frequency is active
  const freq = getClientFrequency(categoryKey, client);
  if (freq === 'not_applicable') return false;
  return true;
}

/**
 * Generate tasks for SPECIFIC selected months.
 * No filtering by "today" — the user decides which months to generate.
 *
 * Frequency logic:
 *   monthly     → task every month (report month = selected month)
 *   bimonthly   → tasks for even report months only (2,4,6,8,10,12)
 *                  covers the previous 2 months (e.g., reportMonth 2 = Jan-Feb)
 *   semi_annual → only for מ"ה ניכויים: reportMonth 6 (Jan-Jun) and 12 (Jul-Dec)
 *                  task in month 07 for 01-06, month 01 for 07-12
 *   quarterly   → report months 3, 6, 9, 12
 */
function generateTasksForMonths(categoryKey, client, selectedMonths, year) {
  const frequency = getClientFrequency(categoryKey, client);
  if (frequency === 'not_applicable') return [];

  const tasks = [];
  const catLabel = REPORT_CATEGORIES[categoryKey].label;

  // Semi-annual: only for ניכויים (מ"ה). Two periods per year.
  // Task appears only when the END month of the period is selected (6 for H1, 12 for H2)
  if (frequency === 'semi_annual') {
    const SEMI_ANNUAL_PERIODS = [
      { reportMonth: 6, period: 'ינואר-יוני', dueMonth: 7, description: `${catLabel} עבור ינואר-יוני ${year}` },
      { reportMonth: 12, period: 'יולי-דצמבר', dueMonth: 1, dueYear: year + 1, description: `${catLabel} עבור יולי-דצמבר ${year}` },
    ];
    for (const sp of SEMI_ANNUAL_PERIODS) {
      // Only show when the last month of the period is selected
      if (!selectedMonths.includes(sp.reportMonth)) continue;

      const dueDateStr = getDueDateForCategory(categoryKey, client, sp.reportMonth);
      const dy = sp.dueYear || year;
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(dy, (sp.dueMonth || 7) - 1, 19);
      tasks.push({ date: dueDate, period: sp.period, description: sp.description, reportMonth: sp.reportMonth });
    }
    return tasks;
  }

  for (const reportMonth of selectedMonths) {
    // Bimonthly: only even report months
    if (frequency === 'bimonthly') {
      if (reportMonth % 2 !== 0) continue;
    }
    // Quarterly: only 3, 6, 9, 12
    if (frequency === 'quarterly') {
      if (![3, 6, 9, 12].includes(reportMonth)) continue;
    }

    const dueDateStr = getDueDateForCategory(categoryKey, client, reportMonth);
    const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(year, reportMonth, 19);

    let period;
    if (frequency === 'bimonthly') {
      period = BIMONTHLY_PERIOD_NAMES[reportMonth] || HEBREW_MONTH_NAMES[reportMonth - 1];
    } else if (frequency === 'quarterly') {
      period = QUARTERLY_PERIOD_NAMES[reportMonth] || HEBREW_MONTH_NAMES[reportMonth - 1];
    } else {
      period = `${HEBREW_MONTH_NAMES[reportMonth - 1]} ${year}`;
    }

    let description;
    if (frequency === 'bimonthly') {
      description = `${catLabel} עבור ${period} ${year}`;
    } else if (frequency === 'quarterly') {
      description = `${catLabel} עבור ${period} ${year}`;
    } else {
      description = `${catLabel} עבור חודש ${HEBREW_MONTH_NAMES[reportMonth - 1]} ${year}`;
    }

    tasks.push({ date: dueDate, period, description, reportMonth });
  }

  return tasks;
}

// ============================================================
// Main Component — ADHD-Friendly Design
// ============================================================
export default function ClientRecurringTasks({ onGenerateComplete }) {
  const [clients, setClients] = useState([]);
  const [existingTasks, setExistingTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTasks, setPreviewTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [results, setResults] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  // Month selection state — user picks which report months to generate
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState(new Set([currentMonth]));
  const [forceInject, setForceInject] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.list(null, 5000).catch(() => [])
      ]);
      const activeClients = (clientsData || []).filter(c => c.status === 'active');
      console.log('[RecurringTasks] Data loaded:', {
        totalClients: (clientsData || []).length,
        activeClients: activeClients.length,
        existingTasks: (tasksData || []).length,
      });
      setClients(activeClients);
      setExistingTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const toggleMonth = (month) => {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  };

  const selectCurrentMonth = () => {
    setSelectedMonths(new Set([currentMonth]));
  };

  // Clear existing recurring tasks for the selected months so re-injection works
  const clearMonthCache = async () => {
    const monthsArray = Array.from(selectedMonths).sort((a, b) => a - b);
    if (monthsArray.length === 0) return;
    setIsClearingCache(true);
    try {
      let deleted = 0;
      for (const task of existingTasks) {
        if (task.source !== 'recurring_tasks' && !task.is_recurring) continue;
        if (!task.due_date) continue;
        const taskDate = new Date(task.due_date);
        const taskMonth = taskDate.getMonth() + 1;
        const taskYear = taskDate.getFullYear();
        if (taskYear === selectedYear && monthsArray.includes(taskMonth)) {
          try {
            await Task.delete(task.id);
            deleted++;
          } catch (e) {
            console.error('Error deleting task:', task.id, e);
          }
        }
      }
      setResults({ cleared: deleted, message: `נמחקו ${deleted} משימות חוזרות לחודשים שנבחרו` });
      await loadData();
    } catch (error) {
      console.error('Error clearing month cache:', error);
    }
    setIsClearingCache(false);
  };

  // ── Task dependency map: parent category → depends_on category ──
  // דוח רו"ה depends on bookkeeping input being done (מע"מ)
  const TASK_DEPENDENCIES = {
    'דוח רו"ה': 'מע"מ',
  };

  const generateTasksPreview = (overrideMonths) => {
    const monthsArray = overrideMonths instanceof Set
      ? Array.from(overrideMonths).sort((a, b) => a - b)
      : Array.from(selectedMonths).sort((a, b) => a - b);
    if (monthsArray.length === 0) return;

    // ── Coverage tracking per category ──
    const coverage = {};
    for (const catKey of Object.keys(REPORT_CATEGORIES)) {
      coverage[catKey] = { eligible: 0, generated: 0, skippedFreq: 0, skippedDup: 0, clients: [] };
    }

    const tasksToCreate = [];
    // First pass: index for depends_on linking
    const taskIndex = {};

    for (const client of clients) {
      const expandedServices = getExpandedServices(client);

      for (const [categoryKey, categoryDef] of Object.entries(REPORT_CATEGORIES)) {
        // ── SERVICE FILTER: strict check against client's actual services ──
        if (!expandedServices.has(categoryDef.serviceTypeKey)) continue;

        const freq = getClientFrequency(categoryKey, client);
        if (freq === 'not_applicable') {
          coverage[categoryKey].skippedFreq++;
          continue;
        }
        coverage[categoryKey].eligible++;

        const dueDates = generateTasksForMonths(categoryKey, client, monthsArray, selectedYear);
        for (const { date, period, description, reportMonth } of dueDates) {
          const taskTitle = `${client.name} - ${description}`;
          const dueDateStr = format(date, 'yyyy-MM-dd');

          // Duplicate check (skip in force-inject mode)
          const alreadyExists = !forceInject && existingTasks.some(t =>
            t.title === taskTitle ||
            (t.client_name === client.name && t.category === categoryKey && t.due_date === dueDateStr)
          );
          if (alreadyExists) {
            coverage[categoryKey].skippedDup++;
            continue;
          }

          const taskId = `${client.id}_${categoryKey}_${dueDateStr}`;
          const clientIs874 = categoryKey === 'מע"מ' && isClient874(client);
          const scheduledStart = getScheduledStartForCategory(categoryKey, dueDateStr);
          const branchKey = categoryDef.branch;
          if (!branchKey || !P_BRANCHES[branchKey]) continue;

          // ── depends_on: link to parent task if exists ──
          const parentCategory = TASK_DEPENDENCIES[categoryKey];
          const parentTaskId = parentCategory ? `${client.id}_${parentCategory}_${dueDateStr}` : null;

          const task = {
            _previewId: taskId, title: taskTitle,
            description: `${description}\nלקוח: ${client.name}${clientIs874 ? '\nסוג: מע"מ מפורט (874)' : ''}`,
            due_date: dueDateStr, scheduled_start: scheduledStart || undefined,
            client_name: client.name, client_id: client.id,
            category: categoryKey, branch: branchKey,
            context: 'work', priority: 'high', status: 'not_started',
            is_recurring: true, source: 'recurring_tasks',
            _categoryOrder: categoryDef.order, _categoryLabel: categoryDef.label,
            _categoryColor: categoryDef.color, _categoryAccent: categoryDef.accent,
            _categoryBgSoft: categoryDef.bgSoft, _categoryDot: categoryDef.dot,
            _branchKey: branchKey, _branchLabel: P_BRANCHES[branchKey].label,
            _frequency: freq, _is874: clientIs874, period,
            _reportMonth: reportMonth,
          };
          if (parentTaskId) task.depends_on = parentTaskId;
          tasksToCreate.push(task);
          taskIndex[taskId] = task;
          coverage[categoryKey].generated++;
          coverage[categoryKey].clients.push(client.name);
        }
      }
    }

    // ── Coverage report ──
    console.group('[RecurringTasks] Coverage Report');
    for (const [catKey, stats] of Object.entries(coverage)) {
      const branch = REPORT_CATEGORIES[catKey]?.branch || '?';
      console.log(
        `${branch} - ${catKey}: ${stats.generated} tasks | ${stats.eligible}/${clients.length} eligible clients | ${stats.skippedFreq} freq-skipped | ${stats.skippedDup} dup-skipped`
      );
    }
    // Cross-reference: find clients that have services but got 0 tasks
    const clientsWithNoTasks = clients.filter(c => {
      const services = getExpandedServices(c);
      return services.size > 0 && !tasksToCreate.some(t => t.client_id === c.id);
    });
    if (clientsWithNoTasks.length > 0) {
      console.warn('[RecurringTasks] Clients with services but 0 tasks:', clientsWithNoTasks.map(c => ({
        name: c.name, services: Array.from(getExpandedServices(c)), reporting_info: c.reporting_info,
      })));
    }
    console.groupEnd();

    tasksToCreate.sort((a, b) => {
      if (a._categoryOrder !== b._categoryOrder) return a._categoryOrder - b._categoryOrder;
      const nameCompare = a.client_name.localeCompare(b.client_name, 'he');
      if (nameCompare !== 0) return nameCompare;
      return new Date(a.due_date) - new Date(b.due_date);
    });
    setPreviewTasks(tasksToCreate);
    setSelectedTaskIds(new Set(tasksToCreate.map(t => t._previewId)));
    setShowPreview(true);
    setCollapsedCategories(new Set());
  };

  const toggleTask = (taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleCategoryAll = (categoryKey, tasks) => {
    const catIds = tasks.map(t => t._previewId);
    const allSelected = catIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      catIds.forEach(id => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const toggleCollapseCategory = (categoryKey) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) next.delete(categoryKey); else next.add(categoryKey);
      return next;
    });
  };

  const selectAll = () => setSelectedTaskIds(new Set(previewTasks.map(t => t._previewId)));
  const selectNone = () => setSelectedTaskIds(new Set());

  const removeFromPreview = (taskId) => {
    setPreviewTasks(prev => prev.filter(t => t._previewId !== taskId));
    setSelectedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
  };

  // Group tasks by P-branch → then by category within each branch
  const groupedByBranch = useMemo(() => {
    const branches = {};
    for (const task of previewTasks) {
      const bKey = task._branchKey || task.branch || 'P2';
      if (!branches[bKey]) {
        const branchDef = P_BRANCHES[bKey] || P_BRANCHES.P2;
        branches[bKey] = {
          branchKey: bKey,
          label: branchDef.label,
          color: branchDef.color,
          accent: branchDef.accent,
          bgSoft: branchDef.bgSoft,
          dot: branchDef.dot,
          order: branchDef.order,
          categories: {},
        };
      }
      const catKey = task.category;
      if (!branches[bKey].categories[catKey]) {
        branches[bKey].categories[catKey] = {
          categoryKey: catKey, label: task._categoryLabel, color: task._categoryColor,
          accent: task._categoryAccent, bgSoft: task._categoryBgSoft, dot: task._categoryDot,
          order: task._categoryOrder, tasks: [],
        };
      }
      branches[bKey].categories[catKey].tasks.push(task);
    }
    // Sort branches by order, categories within each branch by order
    return Object.values(branches)
      .sort((a, b) => a.order - b.order)
      .map(branch => ({
        ...branch,
        categories: Object.values(branch.categories).sort((a, b) => a.order - b.order),
      }));
  }, [previewTasks]);

  const selectedCount = previewTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

  const createTasks = async () => {
    setIsGenerating(true);
    let created = 0, errors = 0;
    const tasksToCreate = previewTasks.filter(t => selectedTaskIds.has(t._previewId));
    for (const taskData of tasksToCreate) {
      try {
        const {
          _previewId, _categoryOrder, _categoryLabel, _categoryColor,
          _categoryAccent, _categoryBgSoft, _categoryDot, _frequency,
          _is874, _reportMonth, _branchKey, _branchLabel, period, ...taskFields
        } = taskData;
        await Task.create(taskFields);
        created++;
      } catch (error) { console.error('Error creating task:', error); errors++; }
    }
    setResults({ created, errors, total: tasksToCreate.length });
    setIsGenerating(false);
    setShowPreview(false);
    await loadData();
    if (onGenerateComplete) onGenerateComplete();
  };

  // Summary grouped by P-branch
  const branchSummary = useMemo(() => {
    const result = [];
    for (const [branchKey, branchDef] of Object.entries(P_BRANCHES)) {
      const branchCategories = [];
      let totalClients = 0;
      for (const catKey of branchDef.categories) {
        const categoryDef = REPORT_CATEGORIES[catKey];
        if (!categoryDef) continue;
        let clientCount = 0;
        const frequencies = {};
        for (const client of clients) {
          if (!clientHasService(catKey, client)) continue;
          const freq = getClientFrequency(catKey, client);
          if (freq === 'not_applicable') continue;
          clientCount++;
          frequencies[freq] = (frequencies[freq] || 0) + 1;
        }
        if (clientCount > 0) {
          branchCategories.push({ key: catKey, label: categoryDef.label, icon: categoryDef.icon, dot: categoryDef.dot, clientCount, frequencies });
          totalClients += clientCount;
        }
      }
      if (totalClients > 0) {
        result.push({ ...branchDef, key: branchKey, totalClients, branchCategories });
      }
    }
    return result;
  }, [clients]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
          <p className="text-lg text-gray-500">טוען נתונים...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Card — Clean & Calm */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-l from-emerald-50 to-emerald-100 pb-6">
          <CardTitle className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">משימות חוזרות</h3>
              <p className="text-base text-emerald-600 font-normal mt-1">
                {clients.length} לקוחות פעילים
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Branch summary — grouped under P1/P2 headers */}
          <div className="space-y-4">
            {branchSummary.map((branch) => (
              <motion.div
                key={branch.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border-2 ${branch.accent} overflow-hidden`}
              >
                {/* Branch header */}
                <div className={`px-4 py-3 ${branch.bgSoft} flex items-center gap-3`}>
                  <div className={`w-4 h-4 rounded-full ${branch.dot}`} />
                  <span className="text-lg font-black text-gray-800">{branch.label}</span>
                  <span className="text-base font-bold text-gray-500 mr-auto">{branch.totalClients} לקוחות</span>
                </div>
                {/* Category cards within branch */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                  {branch.branchCategories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div
                        key={cat.key}
                        className="p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-all"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-3 h-3 rounded-full ${cat.dot}`} />
                          <span className="text-base font-bold text-gray-700">{cat.label}</span>
                        </div>
                        <p className="text-3xl font-black text-gray-800 mb-2">{cat.clientCount}</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(cat.frequencies).map(([freq, count]) => (
                            <span key={freq} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                              {FREQUENCY_LABELS[freq] || freq} ({count})
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ============================================================ */}
          {/* Month picker — user chooses which report months to generate */}
          {/* ============================================================ */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-gray-700">בחרי חודשי דיווח:</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="rounded-xl font-bold text-gray-500 hover:text-gray-700"
                >
                  &lt;
                </Button>
                <span className="text-lg font-black text-emerald-600 min-w-[60px] text-center">{selectedYear}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="rounded-xl font-bold text-gray-500 hover:text-gray-700"
                >
                  &gt;
                </Button>
              </div>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {HEBREW_MONTH_NAMES.map((name, idx) => {
                const month = idx + 1;
                const isSelected = selectedMonths.has(month);
                const isCurrent = month === currentMonth && selectedYear === currentYear;
                return (
                  <Button
                    key={month}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => toggleMonth(month)}
                    className={`rounded-xl h-11 text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                        : isCurrent
                          ? 'border-2 border-emerald-600/50 hover:border-emerald-600 text-emerald-600 font-black'
                          : 'border-2 hover:border-emerald-600/30'
                    }`}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>

            {/* Quick selection buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectCurrentMonth}
                className="rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100"
              >
                חודש נוכחי
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllMonths}
                className="rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-100"
              >
                כל השנה
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMonths(new Set())}
                className="rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100"
              >
                נקה
              </Button>
            </div>
          </div>

          {/* ── Force Inject Mode + Clear Cache ── */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForceInject(!forceInject)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    forceInject ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    forceInject ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <div>
                  <span className="text-base font-bold text-gray-800">הזרקה בכוח</span>
                  <p className="text-sm text-gray-500">
                    {forceInject
                      ? 'מצב פעיל — עוקף בדיקת כפילויות, יוצר משימות גם אם כבר קיימות'
                      : 'כבוי — משימות שכבר קיימות ידולגו'
                    }
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMonthCache}
              disabled={isClearingCache || selectedMonths.size === 0}
              className="rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-bold gap-1 whitespace-nowrap disabled:opacity-40"
            >
              {isClearingCache ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              נקה מטמון {selectedMonths.size > 0 ? `(${selectedMonths.size} חודשים)` : ''}
            </Button>
          </div>

          {/* Quick inject: one-click current month generation */}
          <Button
            onClick={() => {
              setSelectedMonths(new Set([currentMonth]));
              generateTasksPreview(new Set([currentMonth]));
            }}
            className="w-full h-12 text-base font-bold rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Sparkles className="w-5 h-5 ml-2" />
            הזרקת משימות {HEBREW_MONTH_NAMES[currentMonth - 1]} {currentYear} — כל הלקוחות
          </Button>

          {/* Generate button — prominent */}
          <Button
            onClick={() => generateTasksPreview()}
            disabled={selectedMonths.size === 0}
            className="w-full h-14 text-lg font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-40"
            size="lg"
          >
            <Eye className="w-6 h-6 ml-3" />
            {selectedMonths.size === 0
              ? 'בחרי לפחות חודש אחד'
              : `טען משימות ל-${selectedMonths.size} ${selectedMonths.size === 1 ? 'חודש' : 'חודשים'} — להגהה ואישור`
            }
          </Button>

          {/* Results */}
          {results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-2xl border-2 ${results.cleared != null ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${results.cleared != null ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  {results.cleared != null ? (
                    <p className="text-lg font-bold text-amber-800">{results.message}</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-emerald-800">
                        נוצרו {results.created} משימות
                      </p>
                      {results.errors > 0 && (
                        <p className="text-sm text-amber-600">{results.errors} שגיאות</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Preview Dialog — ADHD-Friendly — Review & Approve */}
      {/* ============================================================ */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          {/* Header — clean, with progress */}
          <div className="px-6 pt-6 pb-4 bg-gradient-to-l from-emerald-50 to-emerald-100">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                {previewTasks.length > 0
                  ? `${previewTasks.length} משימות חדשות להגהה`
                  : 'הכל מעודכן!'
                }
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 mt-1">
                {previewTasks.length > 0
                  ? (forceInject
                      ? 'מצב הזרקה בכוח — משימות ייווצרו גם אם קיימות כפילויות. עברי על הרשימה ואשרי.'
                      : 'עברי על הרשימה, בטלי מה שלא צריך, ואשרי יצירה.')
                  : 'כל המשימות לחודשים שנבחרו כבר קיימות.'
                }
              </DialogDescription>
            </DialogHeader>

            {/* Force inject indicator */}
            {forceInject && previewTasks.length > 0 && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">הזרקה בכוח — כפילויות לא נחסמות</span>
              </div>
            )}

            {/* Selected months summary */}
            {previewTasks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {Array.from(selectedMonths).sort((a, b) => a - b).map(m => (
                  <span key={m} className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full">
                    {HEBREW_MONTH_NAMES[m - 1]} {selectedYear}
                  </span>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {previewTasks.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-600">
                    {selectedCount} נבחרו
                  </span>
                  <span className="text-sm text-gray-400">
                    מתוך {previewTasks.length}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-600 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(selectedCount / previewTasks.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          {previewTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-3xl flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-emerald-700 mb-2">הכל מעודכן!</h3>
                <p className="text-gray-500 text-base">כל המשימות לחודשים שנבחרו כבר קיימות</p>
              </div>
            </div>
          ) : (
            <>
              {/* Quick actions — big, clear */}
              <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="rounded-xl font-bold"
                >
                  בחר הכל
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectNone}
                  className="rounded-xl font-bold"
                >
                  נקה הכל
                </Button>
              </div>

              {/* Branch → Category groups — hierarchical, color-coded */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-[#F5F5F5]">
                {groupedByBranch.map((branch, branchIdx) => {
                  const allBranchTasks = branch.categories.flatMap(c => c.tasks);
                  const branchSelectedCount = allBranchTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

                  return (
                    <div key={branch.branchKey} className="space-y-3">
                      {/* Branch header */}
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${branch.bgSoft} border-2 ${branch.accent}`}>
                        <div className={`w-5 h-5 rounded-full ${branch.dot}`} />
                        <span className="text-lg font-black text-gray-800 flex-1">{branch.label}</span>
                        <span className="text-base font-bold text-gray-500">
                          {branchSelectedCount}/{allBranchTasks.length}
                        </span>
                      </div>

                      {/* Categories within this branch */}
                      {branch.categories.map((group, groupIdx) => {
                        const isCollapsed = collapsedCategories.has(group.categoryKey);
                        const groupSelectedCount = group.tasks.filter(t => selectedTaskIds.has(t._previewId)).length;
                        const allGroupSelected = groupSelectedCount === group.tasks.length;

                        return (
                          <motion.div
                            key={group.categoryKey}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (branchIdx * 0.05) + (groupIdx * 0.03) }}
                            className={`rounded-2xl overflow-hidden border-2 ${group.accent} bg-white shadow-sm mr-4`}
                          >
                            {/* Category header */}
                            <div
                              className={`flex items-center gap-3 p-4 cursor-pointer ${group.bgSoft} transition-colors`}
                              onClick={() => toggleCollapseCategory(group.categoryKey)}
                            >
                              <div
                                className="flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleCategoryAll(group.categoryKey, group.tasks); }}
                              >
                                <Checkbox
                                  checked={allGroupSelected}
                                  className="w-6 h-6 rounded-lg border-2"
                                />
                              </div>

                              <div className={`w-4 h-4 rounded-full ${group.dot} flex-shrink-0`} />

                              <span className="text-lg font-black text-gray-800 flex-1">
                                {group.label}
                              </span>

                              <span className="text-base font-bold text-gray-500 mx-2">
                                {groupSelectedCount}/{group.tasks.length}
                              </span>

                              {isCollapsed ?
                                <ChevronRight className="w-5 h-5 text-gray-400" /> :
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              }
                            </div>

                            {/* Task items */}
                            <AnimatePresence>
                              {!isCollapsed && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-3 space-y-2">
                                    {group.tasks.map((task, taskIdx) => {
                                      const isSelected = selectedTaskIds.has(task._previewId);
                                      return (
                                        <motion.div
                                          key={task._previewId}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: taskIdx * 0.02 }}
                                          className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-white border-2 border-gray-200 shadow-sm'
                                              : 'bg-gray-50 border-2 border-transparent opacity-40'
                                          }`}
                                          onClick={() => toggleTask(task._previewId)}
                                        >
                                          <Checkbox
                                            checked={isSelected}
                                            className="w-6 h-6 rounded-lg border-2 flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                            onCheckedChange={() => toggleTask(task._previewId)}
                                          />

                                          <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold text-gray-800 truncate">
                                              {task.client_name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                              <span className="text-sm text-gray-500 font-medium">
                                                {task.period}
                                              </span>
                                              <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                {format(new Date(task.due_date), 'dd/MM')}
                                              </span>
                                              {task._is874 && (
                                                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                                  874
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-gray-300 hover:text-amber-500 h-8 w-8 p-0 rounded-lg flex-shrink-0"
                                            onClick={(e) => { e.stopPropagation(); removeFromPreview(task._previewId); }}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Bottom action bar — sticky, prominent */}
              <div className="px-6 py-4 border-t-2 bg-white">
                <div className="flex gap-3">
                  <Button
                    onClick={createTasks}
                    disabled={isGenerating || selectedCount === 0}
                    className="flex-1 h-14 text-lg font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                        יוצר...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 ml-2" />
                        אשרי יצירת {selectedCount} משימות
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(false)}
                    disabled={isGenerating}
                    className="h-14 px-8 text-base font-bold rounded-2xl border-2"
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
