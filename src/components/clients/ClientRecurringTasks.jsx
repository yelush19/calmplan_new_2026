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
  Clock, Users, FileText, Calculator, Building, Trash2,
  ChevronDown, ChevronRight, Sparkles, Eye, EyeOff
} from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { format, addMonths, setDate, startOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { getDueDateForCategory, isClient874, getDeadlineTypeLabel, HEBREW_MONTH_NAMES } from '@/config/taxCalendar2026';

// ============================================================
// Category definitions with display order
// ============================================================
const REPORT_CATEGORIES = {
  'מע"מ': {
    label: 'מע"מ',
    icon: Calculator,
    color: 'bg-purple-100 text-purple-800',
    accent: 'border-purple-400',
    bgSoft: 'bg-purple-50',
    dot: 'bg-purple-500',
    frequencyField: 'vat_reporting_frequency',
    serviceTypeRequired: ['bookkeeping', 'bookkeeping_full', 'vat_reporting', 'full_service'],
    dayOfMonth: 15,
    order: 1,
  },
  'מקדמות מס': {
    label: 'מקדמות מס',
    icon: Building,
    color: 'bg-teal-100 text-teal-800',
    accent: 'border-teal-400',
    bgSoft: 'bg-teal-50',
    dot: 'bg-teal-500',
    frequencyField: 'tax_advances_frequency',
    serviceTypeRequired: ['bookkeeping', 'bookkeeping_full', 'tax_advances', 'tax_reports', 'full_service'],
    dayOfMonth: 15,
    order: 2,
  },
  'ניכויים': {
    label: 'ניכויים',
    icon: Calculator,
    color: 'bg-amber-100 text-amber-800',
    accent: 'border-amber-400',
    bgSoft: 'bg-amber-50',
    dot: 'bg-amber-500',
    frequencyField: 'deductions_frequency',
    serviceTypeRequired: ['payroll', 'bookkeeping', 'bookkeeping_full', 'full_service'],
    dayOfMonth: 15,
    order: 3,
  },
  'ביטוח לאומי': {
    label: 'ביטוח לאומי',
    icon: Users,
    color: 'bg-emerald-100 text-emerald-800',
    accent: 'border-emerald-400',
    bgSoft: 'bg-emerald-50',
    dot: 'bg-emerald-500',
    frequencyField: 'social_security_frequency',
    serviceTypeRequired: ['payroll', 'bookkeeping', 'bookkeeping_full', 'full_service'],
    dayOfMonth: 15,
    order: 4,
  },
  'שכר': {
    label: 'שכר',
    icon: FileText,
    color: 'bg-sky-100 text-sky-800',
    accent: 'border-sky-400',
    bgSoft: 'bg-sky-50',
    dot: 'bg-sky-500',
    frequencyField: 'payroll_frequency',
    serviceTypeRequired: ['payroll', 'full_service'],
    dayOfMonth: 15,
    order: 5,
  },
  'דוח שנתי': {
    label: 'דוח שנתי',
    icon: Calendar,
    color: 'bg-rose-100 text-rose-800',
    accent: 'border-rose-400',
    bgSoft: 'bg-rose-50',
    dot: 'bg-rose-500',
    frequencyField: null,
    serviceTypeRequired: ['annual_reports', 'tax_reports', 'bookkeeping', 'bookkeeping_full', 'full_service'],
    dayOfMonth: null,
    order: 6,
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
  yearly: 'שנתי',
};

function getClientFrequency(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return 'monthly';
  if (categoryKey === 'דוח שנתי') return 'yearly';
  const field = cat.frequencyField;
  if (!field) return 'monthly';
  const freq = client.reporting_info?.[field];
  return freq || 'monthly';
}

function clientHasService(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return false;
  const services = client.service_types || [];
  if (services.length === 0) return true;
  return cat.serviceTypeRequired.some(st => services.includes(st));
}

/**
 * Generate due dates for a given category and client.
 * Uses the official 2026 tax calendar for accurate deadlines.
 */
function generateDueDates(categoryKey, client, monthsAhead) {
  const frequency = getClientFrequency(categoryKey, client);
  if (frequency === 'not_applicable') return [];

  const now = new Date();
  const year = now.getFullYear();
  const dates = [];

  if (frequency === 'yearly') {
    const dueDate = new Date(year, 4, 31);
    if (dueDate >= now) {
      dates.push({ date: dueDate, period: `${year - 1}`, description: `דוח שנתי לשנת ${year - 1}` });
    }
    if (monthsAhead > 6) {
      dates.push({ date: new Date(year + 1, 4, 31), period: `${year}`, description: `דוח שנתי לשנת ${year}` });
    }
    return dates;
  }

  const is874 = isClient874(client);

  if (frequency === 'bimonthly') {
    const biMonths = [2, 4, 6, 8, 10, 12];
    for (const m of biMonths) {
      const dueDateStr = getDueDateForCategory(categoryKey, client, m);
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(year, m, 15);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({ date: dueDate, period: BIMONTHLY_PERIOD_NAMES[m], description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${BIMONTHLY_PERIOD_NAMES[m]} ${year}`, is874 });
      }
    }
    for (const m of biMonths) {
      const dueDate = new Date(year + 1, m, 19);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({ date: dueDate, period: BIMONTHLY_PERIOD_NAMES[m], description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${BIMONTHLY_PERIOD_NAMES[m]} ${year + 1}`, is874 });
      }
    }
    return dates;
  }

  if (frequency === 'quarterly') {
    const qMonths = [3, 6, 9, 12];
    for (const m of qMonths) {
      const dueDateStr = getDueDateForCategory(categoryKey, client, m);
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(year, m, 15);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({ date: dueDate, period: QUARTERLY_PERIOD_NAMES[m], description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${QUARTERLY_PERIOD_NAMES[m]} ${year}`, is874 });
      }
    }
    for (const m of qMonths) {
      const dueDate = new Date(year + 1, m, 19);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({ date: dueDate, period: QUARTERLY_PERIOD_NAMES[m], description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${QUARTERLY_PERIOD_NAMES[m]} ${year + 1}`, is874 });
      }
    }
    return dates;
  }

  // Monthly
  const currentMonth = now.getMonth() + 1;
  for (let i = 0; i < monthsAhead; i++) {
    const reportMonthNum = ((currentMonth - 1 + i) % 12) + 1;
    const reportYear = year + Math.floor((currentMonth - 1 + i) / 12);
    const dueDateStr = getDueDateForCategory(categoryKey, client, reportMonthNum);
    let dueDate;
    if (dueDateStr) {
      dueDate = new Date(dueDateStr);
    } else {
      const nextMonth = reportMonthNum === 12 ? 1 : reportMonthNum + 1;
      const nextYear = reportMonthNum === 12 ? reportYear + 1 : reportYear;
      dueDate = new Date(nextYear, nextMonth - 1, 19);
    }
    if (dueDate >= now) {
      const monthName = HEBREW_MONTH_NAMES[reportMonthNum - 1];
      dates.push({ date: dueDate, period: `${monthName} ${reportYear}`, description: `${REPORT_CATEGORIES[categoryKey].label} עבור חודש ${monthName} ${reportYear}`, is874 });
    }
  }
  return dates;
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
  const [generateMonths, setGenerateMonths] = useState(3);
  const [results, setResults] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.list(null, 5000).catch(() => [])
      ]);
      setClients((clientsData || []).filter(c => c.status === 'active'));
      setExistingTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const generateTasksPreview = () => {
    const tasksToCreate = [];
    for (const client of clients) {
      for (const [categoryKey, categoryDef] of Object.entries(REPORT_CATEGORIES)) {
        if (!clientHasService(categoryKey, client)) continue;
        const freq = getClientFrequency(categoryKey, client);
        if (freq === 'not_applicable') continue;
        const dueDates = generateDueDates(categoryKey, client, generateMonths);
        for (const { date, period, description } of dueDates) {
          const taskTitle = `${client.name} - ${description}`;
          const dueDateStr = format(date, 'yyyy-MM-dd');
          const alreadyExists = existingTasks.some(t =>
            t.title === taskTitle ||
            (t.client_name === client.name && t.category === categoryKey && t.due_date === dueDateStr)
          );
          if (!alreadyExists) {
            const taskId = `${client.id}_${categoryKey}_${dueDateStr}`;
            const clientIs874 = isClient874(client);
            tasksToCreate.push({
              _previewId: taskId, title: taskTitle,
              description: `${description}\nלקוח: ${client.name}${clientIs874 ? '\nסוג: מע"מ מפורט (874)' : ''}`,
              due_date: dueDateStr, client_name: client.name, client_id: client.id,
              category: categoryKey, context: 'work', priority: 'high', status: 'not_started', is_recurring: true,
              _categoryOrder: categoryDef.order, _categoryLabel: categoryDef.label,
              _categoryColor: categoryDef.color, _categoryAccent: categoryDef.accent,
              _categoryBgSoft: categoryDef.bgSoft, _categoryDot: categoryDef.dot,
              _frequency: freq, _is874: clientIs874, period,
            });
          }
        }
      }
    }
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

  const groupedTasks = useMemo(() => {
    const groups = {};
    for (const task of previewTasks) {
      const key = task.category;
      if (!groups[key]) {
        groups[key] = {
          categoryKey: key, label: task._categoryLabel, color: task._categoryColor,
          accent: task._categoryAccent, bgSoft: task._categoryBgSoft, dot: task._categoryDot,
          order: task._categoryOrder, tasks: [],
        };
      }
      groups[key].tasks.push(task);
    }
    return Object.values(groups).sort((a, b) => a.order - b.order);
  }, [previewTasks]);

  const selectedCount = previewTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

  const createTasks = async () => {
    setIsGenerating(true);
    let created = 0, errors = 0;
    const tasksToCreate = previewTasks.filter(t => selectedTaskIds.has(t._previewId));
    for (const taskData of tasksToCreate) {
      try {
        const { _previewId, _categoryOrder, _categoryLabel, _categoryColor, _categoryAccent, _categoryBgSoft, _categoryDot, _frequency, _is874, period, ...taskFields } = taskData;
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

  const categorySummary = useMemo(() => {
    const summary = {};
    for (const [categoryKey, categoryDef] of Object.entries(REPORT_CATEGORIES)) {
      let clientCount = 0;
      for (const client of clients) {
        if (!clientHasService(categoryKey, client)) continue;
        if (getClientFrequency(categoryKey, client) === 'not_applicable') continue;
        clientCount++;
      }
      if (clientCount > 0) {
        summary[categoryKey] = { label: categoryDef.label, color: categoryDef.color, icon: categoryDef.icon, dot: categoryDef.dot, clientCount, frequencies: {} };
        for (const client of clients) {
          if (!clientHasService(categoryKey, client)) continue;
          const freq = getClientFrequency(categoryKey, client);
          if (freq === 'not_applicable') continue;
          summary[categoryKey].frequencies[freq] = (summary[categoryKey].frequencies[freq] || 0) + 1;
        }
      }
    }
    return summary;
  }, [clients]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#657453]/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-[#657453]" />
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
        <CardHeader className="bg-gradient-to-l from-[#657453]/5 to-[#657453]/15 pb-6">
          <CardTitle className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-[#657453]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">משימות חוזרות</h3>
              <p className="text-base text-[#657453] font-normal mt-1">
                {clients.length} לקוחות פעילים
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Category summary — large, spaced cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(categorySummary).map(([key, info]) => {
              const Icon = info.icon;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-white border-2 border-gray-100 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${info.dot}`} />
                    <span className="text-base font-bold text-gray-700">{info.label}</span>
                  </div>
                  <p className="text-3xl font-black text-gray-800 mb-2">{info.clientCount}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(info.frequencies).map(([freq, count]) => (
                      <span key={freq} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                        {FREQUENCY_LABELS[freq] || freq} ({count})
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Period selector — big buttons */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-base font-bold text-gray-700 mb-3">תקופת יצירה:</p>
            <div className="flex gap-3">
              {[1, 3, 6, 12].map(months => (
                <Button
                  key={months}
                  variant={generateMonths === months ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => setGenerateMonths(months)}
                  className={`flex-1 text-base rounded-xl h-12 font-bold ${
                    generateMonths === months
                      ? 'bg-[#657453] hover:bg-[#4a5f3a] text-white shadow-md'
                      : 'border-2 hover:border-[#657453]/30'
                  }`}
                >
                  {months} {months === 1 ? 'חודש' : 'חודשים'}
                </Button>
              ))}
            </div>
          </div>

          {/* Generate button — prominent */}
          <Button
            onClick={generateTasksPreview}
            className="w-full h-14 text-lg font-bold rounded-2xl bg-[#657453] hover:bg-[#4a5f3a] shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Eye className="w-6 h-6 ml-3" />
            תצוגה מקדימה
          </Button>

          {/* Results */}
          {results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-800">
                    נוצרו {results.created} משימות
                  </p>
                  {results.errors > 0 && (
                    <p className="text-sm text-amber-600">{results.errors} שגיאות</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Preview Dialog — ADHD-Friendly */}
      {/* ============================================================ */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          {/* Header — clean, with progress */}
          <div className="px-6 pt-6 pb-4 bg-gradient-to-l from-[#657453]/5 to-[#657453]/15">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                {previewTasks.length > 0
                  ? `${previewTasks.length} משימות חדשות`
                  : 'הכל מעודכן!'
                }
              </DialogTitle>
              <DialogDescription className="text-base text-gray-600 mt-1">
                סמני מה ליצור. אפשר לבטל פריטים בודדים.
              </DialogDescription>
            </DialogHeader>

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
                    className="h-full bg-[#657453] rounded-full"
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
                <p className="text-gray-500 text-base">כל המשימות כבר קיימות</p>
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

              {/* Category groups — spacious, color-coded */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 bg-gray-50/50">
                {groupedTasks.map((group, groupIdx) => {
                  const isCollapsed = collapsedCategories.has(group.categoryKey);
                  const groupSelectedCount = group.tasks.filter(t => selectedTaskIds.has(t._previewId)).length;
                  const allGroupSelected = groupSelectedCount === group.tasks.length;

                  return (
                    <motion.div
                      key={group.categoryKey}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.05 }}
                      className={`rounded-2xl overflow-hidden border-2 ${group.accent} bg-white shadow-sm`}
                    >
                      {/* Category header — bold, spacious */}
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

                      {/* Task items — clean cards */}
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
                                        <span className="text-sm font-bold text-[#657453] bg-[#657453]/10 px-2.5 py-0.5 rounded-full">
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
                                      className="text-gray-300 hover:text-red-500 h-8 w-8 p-0 rounded-lg flex-shrink-0"
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

              {/* Bottom action bar — sticky, prominent */}
              <div className="px-6 py-4 border-t-2 bg-white">
                <div className="flex gap-3">
                  <Button
                    onClick={createTasks}
                    disabled={isGenerating || selectedCount === 0}
                    className="flex-1 h-14 text-lg font-bold rounded-2xl bg-[#657453] hover:bg-[#4a5f3a] shadow-lg disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                        יוצר...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 ml-2" />
                        צור {selectedCount} משימות
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
