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
  ChevronDown, ChevronRight
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
    frequencyField: 'vat_reporting_frequency',
    serviceTypeRequired: ['bookkeeping', 'bookkeeping_full', 'vat_reporting', 'full_service'],
    dayOfMonth: 15,
    order: 1,
  },
  'מקדמות מס': {
    label: 'מקדמות מס',
    icon: Building,
    color: 'bg-teal-100 text-teal-800',
    frequencyField: 'tax_advances_frequency',
    serviceTypeRequired: ['bookkeeping', 'bookkeeping_full', 'tax_advances', 'tax_reports', 'full_service'],
    dayOfMonth: 15,
    order: 2,
  },
  'ניכויים': {
    label: 'ניכויים',
    icon: Calculator,
    color: 'bg-orange-100 text-orange-800',
    frequencyField: 'deductions_frequency',
    serviceTypeRequired: ['payroll', 'bookkeeping', 'bookkeeping_full', 'full_service'],
    dayOfMonth: 15,
    order: 3,
  },
  'ביטוח לאומי': {
    label: 'ביטוח לאומי',
    icon: Users,
    color: 'bg-green-100 text-green-800',
    frequencyField: 'social_security_frequency',
    serviceTypeRequired: ['payroll', 'bookkeeping', 'bookkeeping_full', 'full_service'],
    dayOfMonth: 15,
    order: 4,
  },
  'שכר': {
    label: 'שכר',
    icon: FileText,
    color: 'bg-blue-100 text-blue-800',
    frequencyField: 'payroll_frequency',
    serviceTypeRequired: ['payroll', 'full_service'],
    dayOfMonth: 15,
    order: 5,
  },
  'דוח שנתי': {
    label: 'דוח שנתי',
    icon: Calendar,
    color: 'bg-red-100 text-red-800',
    frequencyField: null, // always yearly
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

/**
 * Get the client's frequency for a given category.
 * Returns 'monthly' | 'bimonthly' | 'quarterly' | 'not_applicable' | 'yearly'
 */
function getClientFrequency(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return 'monthly';

  // Annual report is always yearly
  if (categoryKey === 'דוח שנתי') return 'yearly';

  const field = cat.frequencyField;
  if (!field) return 'monthly';

  const freq = client.reporting_info?.[field];
  return freq || 'monthly';
}

/**
 * Check if the client has a matching service type for this category
 */
function clientHasService(categoryKey, client) {
  const cat = REPORT_CATEGORIES[categoryKey];
  if (!cat) return false;

  const services = client.service_types || [];
  if (services.length === 0) return true; // If no services defined, include all
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
    // Annual report - due May 31
    const dueDate = new Date(year, 4, 31);
    if (dueDate >= now) {
      dates.push({
        date: dueDate,
        period: `${year - 1}`,
        description: `דוח שנתי לשנת ${year - 1}`,
      });
    }
    if (monthsAhead > 6) {
      dates.push({
        date: new Date(year + 1, 4, 31),
        period: `${year}`,
        description: `דוח שנתי לשנת ${year}`,
      });
    }
    return dates;
  }

  // Use the tax calendar for accurate due dates
  const is874 = isClient874(client);

  if (frequency === 'bimonthly') {
    const biMonths = [2, 4, 6, 8, 10, 12];
    for (const m of biMonths) {
      // Get official due date from tax calendar
      const dueDateStr = getDueDateForCategory(categoryKey, client, m);
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(year, m, 15);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({
          date: dueDate,
          period: BIMONTHLY_PERIOD_NAMES[m],
          description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${BIMONTHLY_PERIOD_NAMES[m]} ${year}`,
          is874,
        });
      }
    }
    // Next year
    for (const m of biMonths) {
      const dueDate = new Date(year + 1, m, 19); // fallback for next year
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({
          date: dueDate,
          period: BIMONTHLY_PERIOD_NAMES[m],
          description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${BIMONTHLY_PERIOD_NAMES[m]} ${year + 1}`,
          is874,
        });
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
        dates.push({
          date: dueDate,
          period: QUARTERLY_PERIOD_NAMES[m],
          description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${QUARTERLY_PERIOD_NAMES[m]} ${year}`,
          is874,
        });
      }
    }
    for (const m of qMonths) {
      const dueDate = new Date(year + 1, m, 19);
      if (dueDate >= now && dueDate <= addMonths(now, monthsAhead)) {
        dates.push({
          date: dueDate,
          period: QUARTERLY_PERIOD_NAMES[m],
          description: `${REPORT_CATEGORIES[categoryKey].label} עבור ${QUARTERLY_PERIOD_NAMES[m]} ${year + 1}`,
          is874,
        });
      }
    }
    return dates;
  }

  // Monthly - use the tax calendar for each month
  const currentMonth = now.getMonth() + 1; // 1-12
  for (let i = 0; i < monthsAhead; i++) {
    const reportMonthNum = ((currentMonth - 1 + i) % 12) + 1;
    const reportYear = year + Math.floor((currentMonth - 1 + i) / 12);

    // Get the official due date from the tax calendar
    const dueDateStr = getDueDateForCategory(categoryKey, client, reportMonthNum);
    let dueDate;
    if (dueDateStr) {
      dueDate = new Date(dueDateStr);
    } else {
      // Fallback: 19th of following month
      const nextMonth = reportMonthNum === 12 ? 1 : reportMonthNum + 1;
      const nextYear = reportMonthNum === 12 ? reportYear + 1 : reportYear;
      dueDate = new Date(nextYear, nextMonth - 1, 19);
    }

    if (dueDate >= now) {
      const monthName = HEBREW_MONTH_NAMES[reportMonthNum - 1];
      dates.push({
        date: dueDate,
        period: `${monthName} ${reportYear}`,
        description: `${REPORT_CATEGORIES[categoryKey].label} עבור חודש ${monthName} ${reportYear}`,
        is874,
      });
    }
  }
  return dates;
}

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

  useEffect(() => {
    loadData();
  }, []);

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
        // Check if client has matching service
        if (!clientHasService(categoryKey, client)) continue;

        // Check frequency
        const freq = getClientFrequency(categoryKey, client);
        if (freq === 'not_applicable') continue;

        // Generate due dates
        const dueDates = generateDueDates(categoryKey, client, generateMonths);

        for (const { date, period, description } of dueDates) {
          const taskTitle = `${client.name} - ${description}`;
          const dueDateStr = format(date, 'yyyy-MM-dd');

          // Check if task already exists
          const alreadyExists = existingTasks.some(t =>
            t.title === taskTitle ||
            (t.client_name === client.name &&
             t.category === categoryKey &&
             t.due_date === dueDateStr)
          );

          if (!alreadyExists) {
            const taskId = `${client.id}_${categoryKey}_${dueDateStr}`;
            const clientIs874 = isClient874(client);
            tasksToCreate.push({
              _previewId: taskId,
              title: taskTitle,
              description: `${description}\nלקוח: ${client.name}${clientIs874 ? '\nסוג: מע"מ מפורט (874)' : ''}`,
              due_date: dueDateStr,
              client_name: client.name,
              client_id: client.id,
              category: categoryKey,
              context: 'work',
              priority: 'high',
              status: 'not_started',
              is_recurring: true,
              _categoryOrder: categoryDef.order,
              _categoryLabel: categoryDef.label,
              _categoryColor: categoryDef.color,
              _frequency: freq,
              _is874: clientIs874,
              period,
            });
          }
        }
      }
    }

    // Sort: by category order, then by client name A-Z, then by date
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
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleCategoryAll = (categoryKey, tasks) => {
    const catIds = tasks.map(t => t._previewId);
    const allSelected = catIds.every(id => selectedTaskIds.has(id));

    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      catIds.forEach(id => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const toggleCollapseCategory = (categoryKey) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTaskIds(new Set(previewTasks.map(t => t._previewId)));
  };

  const selectNone = () => {
    setSelectedTaskIds(new Set());
  };

  const removeFromPreview = (taskId) => {
    setPreviewTasks(prev => prev.filter(t => t._previewId !== taskId));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // Group tasks by category for display
  const groupedTasks = useMemo(() => {
    const groups = {};
    for (const task of previewTasks) {
      const key = task.category;
      if (!groups[key]) {
        groups[key] = {
          categoryKey: key,
          label: task._categoryLabel,
          color: task._categoryColor,
          order: task._categoryOrder,
          tasks: [],
        };
      }
      groups[key].tasks.push(task);
    }
    return Object.values(groups).sort((a, b) => a.order - b.order);
  }, [previewTasks]);

  const selectedCount = previewTasks.filter(t => selectedTaskIds.has(t._previewId)).length;

  const createTasks = async () => {
    setIsGenerating(true);
    let created = 0;
    let errors = 0;

    const tasksToCreate = previewTasks.filter(t => selectedTaskIds.has(t._previewId));

    for (const taskData of tasksToCreate) {
      try {
        const {
          _previewId, _categoryOrder, _categoryLabel, _categoryColor, _frequency, period,
          ...taskFields
        } = taskData;
        await Task.create(taskFields);
        created++;
      } catch (error) {
        console.error('Error creating task:', error);
        errors++;
      }
    }

    setResults({ created, errors, total: tasksToCreate.length });
    setIsGenerating(false);
    setShowPreview(false);

    await loadData();
    if (onGenerateComplete) onGenerateComplete();
  };

  // Summary: how many tasks per category
  const categorySummary = useMemo(() => {
    const summary = {};
    for (const [categoryKey, categoryDef] of Object.entries(REPORT_CATEGORIES)) {
      let clientCount = 0;
      for (const client of clients) {
        if (!clientHasService(categoryKey, client)) continue;
        const freq = getClientFrequency(categoryKey, client);
        if (freq === 'not_applicable') continue;
        clientCount++;
      }
      if (clientCount > 0) {
        summary[categoryKey] = {
          label: categoryDef.label,
          color: categoryDef.color,
          icon: categoryDef.icon,
          clientCount,
          frequencies: {},
        };
        // Count by frequency
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
      <Card>
        <CardContent className="p-6 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">טוען נתונים...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">יצירת משימות חוזרות ללקוחות</h3>
              <p className="text-sm text-gray-500 font-normal">
                {clients.length} לקוחות פעילים — לפי תדירות דיווח בכרטיס לקוח
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category summary cards with frequency breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(categorySummary).map(([key, info]) => {
              const Icon = info.icon;
              return (
                <div key={key} className={`p-3 rounded-lg ${info.color} flex items-start gap-2`}>
                  <Icon className="w-4 h-4 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-xs opacity-80">{info.clientCount} לקוחות</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(info.frequencies).map(([freq, count]) => (
                        <span key={freq} className="text-xs bg-white/50 px-1.5 py-0.5 rounded">
                          {FREQUENCY_LABELS[freq] || freq}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Label className="font-medium">יצירה ל:</Label>
            <div className="flex gap-2">
              {[1, 3, 6, 12].map(months => (
                <Button
                  key={months}
                  variant={generateMonths === months ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGenerateMonths(months)}
                >
                  {months} {months === 1 ? 'חודש' : 'חודשים'}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={generateTasksPreview}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 ml-2" />
            הצג תצוגה מקדימה ({clients.length} לקוחות × {generateMonths} חודשים)
          </Button>

          {results && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg ${results.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${results.errors > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                <span className="font-medium">
                  נוצרו {results.created} משימות בהצלחה
                  {results.errors > 0 && ` (${results.errors} שגיאות)`}
                </span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              תצוגה מקדימה - {previewTasks.length} משימות חדשות
            </DialogTitle>
            <DialogDescription>
              סמנו את המשימות שברצונכם ליצור. מסודר לפי סוג דיווח → לקוחות א-ב.
            </DialogDescription>
          </DialogHeader>

          {previewTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold text-green-700">הכל מעודכן!</h3>
              <p className="text-gray-500">כל המשימות כבר קיימות במערכת</p>
            </div>
          ) : (
            <>
              {/* Selection controls */}
              <div className="flex items-center gap-3 py-2 border-b">
                <Button variant="outline" size="sm" onClick={selectAll}>בחר הכל</Button>
                <Button variant="outline" size="sm" onClick={selectNone}>בטל הכל</Button>
                <span className="text-sm text-gray-600 mr-auto">
                  {selectedCount} מתוך {previewTasks.length} נבחרו
                </span>
              </div>

              {/* Grouped task list */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2">
                {groupedTasks.map(group => {
                  const isCollapsed = collapsedCategories.has(group.categoryKey);
                  const groupSelectedCount = group.tasks.filter(t => selectedTaskIds.has(t._previewId)).length;
                  const allGroupSelected = groupSelectedCount === group.tasks.length;

                  return (
                    <div key={group.categoryKey} className="border rounded-lg overflow-hidden">
                      {/* Category header */}
                      <div
                        className={`flex items-center gap-2 p-3 cursor-pointer ${group.color} border-b`}
                        onClick={() => toggleCollapseCategory(group.categoryKey)}
                      >
                        <Checkbox
                          checked={allGroupSelected}
                          onCheckedChange={() => toggleCategoryAll(group.categoryKey, group.tasks)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white"
                        />
                        {isCollapsed ?
                          <ChevronRight className="w-4 h-4" /> :
                          <ChevronDown className="w-4 h-4" />
                        }
                        <span className="font-semibold text-sm">{group.label}</span>
                        <Badge variant="outline" className="mr-auto bg-white/60 text-xs">
                          {groupSelectedCount}/{group.tasks.length} נבחרו
                        </Badge>
                      </div>

                      {/* Tasks in category */}
                      {!isCollapsed && (
                        <div className="divide-y">
                          {group.tasks.map(task => (
                            <div
                              key={task._previewId}
                              className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                                selectedTaskIds.has(task._previewId) ? 'bg-white' : 'bg-gray-50/50 opacity-60'
                              }`}
                            >
                              <Checkbox
                                checked={selectedTaskIds.has(task._previewId)}
                                onCheckedChange={() => toggleTask(task._previewId)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{task.client_name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{task.period}</span>
                                  <span>•</span>
                                  <span>יעד: {format(new Date(task.due_date), 'dd/MM/yyyy')}</span>
                                  <span>•</span>
                                  <span className="text-gray-400">{FREQUENCY_LABELS[task._frequency]}</span>
                                  {task._is874 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-purple-600 font-medium">874 מפורט</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-red-500 h-7 w-7 p-0"
                                onClick={() => removeFromPreview(task._previewId)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-3 border-t">
                <Button
                  onClick={createTasks}
                  disabled={isGenerating || selectedCount === 0}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                      יוצר...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 ml-2" />
                      צור {selectedCount} משימות
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                  disabled={isGenerating}
                >
                  ביטול
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
