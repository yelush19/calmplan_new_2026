import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  RefreshCw, CheckCircle, AlertTriangle, Calendar, Plus,
  Clock, Users, FileText, Calculator, Building
} from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { format, addMonths, setDate, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';

// Accounting task templates - Israeli accounting calendar
const RECURRING_TASK_TEMPLATES = {
  vat_bimonthly: {
    name: 'דיווח מע"מ דו-חודשי',
    category: 'מע"מ',
    icon: Calculator,
    color: 'bg-purple-100 text-purple-800',
    frequency: 'bi-monthly',
    // VAT months: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
    getNextDueDates: (fromDate) => {
      const dates = [];
      const vatMonths = [2, 4, 6, 8, 10, 12]; // Due months (report for prev 2 months)
      const year = fromDate.getFullYear();

      vatMonths.forEach(month => {
        // Due by 15th of the month after the period
        const dueDate = new Date(year, month - 1, 15);
        if (dueDate >= fromDate) {
          dates.push({
            date: dueDate,
            period: `${getPeriodName(month)}`,
            description: `דיווח מע"מ עבור ${getPeriodName(month)} ${year}`
          });
        }
      });

      // Add first half of next year
      vatMonths.slice(0, 3).forEach(month => {
        const dueDate = new Date(year + 1, month - 1, 15);
        dates.push({
          date: dueDate,
          period: `${getPeriodName(month)}`,
          description: `דיווח מע"מ עבור ${getPeriodName(month)} ${year + 1}`
        });
      });

      return dates;
    }
  },
  payroll_monthly: {
    name: 'דיווח שכר חודשי',
    category: 'שכר',
    icon: FileText,
    color: 'bg-blue-100 text-blue-800',
    frequency: 'monthly',
    getNextDueDates: (fromDate) => {
      const dates = [];
      for (let i = 0; i < 12; i++) {
        const reportMonth = addMonths(fromDate, i);
        const dueDate = setDate(addMonths(reportMonth, 1), 15);
        if (dueDate >= fromDate) {
          dates.push({
            date: dueDate,
            period: format(reportMonth, 'MMMM yyyy', { locale: he }),
            description: `דיווח שכר עבור חודש ${format(reportMonth, 'MMMM yyyy', { locale: he })}`
          });
        }
      }
      return dates;
    }
  },
  tax_advances_monthly: {
    name: 'מקדמות מס',
    category: 'מקדמות מס',
    icon: Building,
    color: 'bg-teal-100 text-teal-800',
    frequency: 'monthly',
    getNextDueDates: (fromDate) => {
      const dates = [];
      for (let i = 0; i < 12; i++) {
        const month = addMonths(fromDate, i);
        const dueDate = setDate(addMonths(month, 1), 15);
        if (dueDate >= fromDate) {
          dates.push({
            date: dueDate,
            period: format(month, 'MMMM yyyy', { locale: he }),
            description: `מקדמות מס עבור חודש ${format(month, 'MMMM yyyy', { locale: he })}`
          });
        }
      }
      return dates;
    }
  },
  social_security_monthly: {
    name: 'ביטוח לאומי',
    category: 'ביטוח לאומי',
    icon: Users,
    color: 'bg-green-100 text-green-800',
    frequency: 'monthly',
    getNextDueDates: (fromDate) => {
      const dates = [];
      for (let i = 0; i < 12; i++) {
        const month = addMonths(fromDate, i);
        const dueDate = setDate(addMonths(month, 1), 15);
        if (dueDate >= fromDate) {
          dates.push({
            date: dueDate,
            period: format(month, 'MMMM yyyy', { locale: he }),
            description: `דיווח ביטוח לאומי עבור ${format(month, 'MMMM yyyy', { locale: he })}`
          });
        }
      }
      return dates;
    }
  },
  annual_report: {
    name: 'דוח שנתי',
    category: 'דוח שנתי',
    icon: Calendar,
    color: 'bg-red-100 text-red-800',
    frequency: 'yearly',
    getNextDueDates: (fromDate) => {
      const year = fromDate.getFullYear();
      const dates = [];
      // Annual report for previous year, due by end of May
      const dueDate = new Date(year, 4, 31); // May 31
      if (dueDate >= fromDate) {
        dates.push({
          date: dueDate,
          period: `${year - 1}`,
          description: `דוח שנתי לשנת ${year - 1}`
        });
      }
      // Next year's report
      dates.push({
        date: new Date(year + 1, 4, 31),
        period: `${year}`,
        description: `דוח שנתי לשנת ${year}`
      });
      return dates;
    }
  },
  deductions_monthly: {
    name: 'ניכויים במקור',
    category: 'ניכויים',
    icon: Calculator,
    color: 'bg-orange-100 text-orange-800',
    frequency: 'monthly',
    getNextDueDates: (fromDate) => {
      const dates = [];
      for (let i = 0; i < 12; i++) {
        const month = addMonths(fromDate, i);
        const dueDate = setDate(addMonths(month, 1), 15);
        if (dueDate >= fromDate) {
          dates.push({
            date: dueDate,
            period: format(month, 'MMMM yyyy', { locale: he }),
            description: `דיווח ניכויים עבור ${format(month, 'MMMM yyyy', { locale: he })}`
          });
        }
      }
      return dates;
    }
  }
};

function getPeriodName(dueMonth) {
  const periods = {
    2: 'ינואר-פברואר',
    4: 'מרץ-אפריל',
    6: 'מאי-יוני',
    8: 'יולי-אוגוסט',
    10: 'ספטמבר-אוקטובר',
    12: 'נובמבר-דצמבר'
  };
  return periods[dueMonth] || '';
}

// Map client service_types to task templates
const SERVICE_TYPE_TO_TEMPLATES = {
  'bookkeeping': ['vat_bimonthly', 'payroll_monthly', 'tax_advances_monthly', 'social_security_monthly', 'deductions_monthly'],
  'payroll': ['payroll_monthly', 'social_security_monthly', 'deductions_monthly'],
  'tax_reports': ['annual_report', 'tax_advances_monthly'],
  'vat': ['vat_bimonthly'],
  'annual_reports': ['annual_report'],
  'full_service': ['vat_bimonthly', 'payroll_monthly', 'tax_advances_monthly', 'social_security_monthly', 'annual_report', 'deductions_monthly'],
};

export default function ClientRecurringTasks({ onGenerateComplete }) {
  const [clients, setClients] = useState([]);
  const [existingTasks, setExistingTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTasks, setPreviewTasks] = useState([]);
  const [generateMonths, setGenerateMonths] = useState(3);
  const [results, setResults] = useState(null);

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
    const now = new Date();
    const tasksToCreate = [];

    clients.forEach(client => {
      // Determine which templates apply based on service_types
      const serviceTypes = client.service_types || ['full_service'];
      const templateKeys = new Set();

      serviceTypes.forEach(st => {
        const templates = SERVICE_TYPE_TO_TEMPLATES[st] || SERVICE_TYPE_TO_TEMPLATES['full_service'];
        templates.forEach(t => templateKeys.add(t));
      });

      templateKeys.forEach(templateKey => {
        const template = RECURRING_TASK_TEMPLATES[templateKey];
        if (!template) return;

        const dueDates = template.getNextDueDates(now);
        const limitedDates = dueDates.slice(0, generateMonths);

        limitedDates.forEach(({ date, period, description }) => {
          const taskTitle = `${client.name} - ${description}`;

          // Check if task already exists
          const alreadyExists = existingTasks.some(t =>
            t.title === taskTitle ||
            (t.client_name === client.name &&
             t.category === template.category &&
             t.due_date === format(date, 'yyyy-MM-dd'))
          );

          if (!alreadyExists) {
            tasksToCreate.push({
              title: taskTitle,
              description: `${description}\nלקוח: ${client.name}`,
              due_date: format(date, 'yyyy-MM-dd'),
              client_name: client.name,
              client_id: client.id,
              category: template.category,
              priority: 'high',
              status: 'not_started',
              is_recurring: true,
              templateKey,
              templateName: template.name,
              templateColor: template.color,
              period
            });
          }
        });
      });
    });

    tasksToCreate.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    setPreviewTasks(tasksToCreate);
    setShowPreview(true);
  };

  const createTasks = async () => {
    setIsGenerating(true);
    let created = 0;
    let errors = 0;

    for (const taskData of previewTasks) {
      try {
        const { templateKey, templateName, templateColor, period, ...taskFields } = taskData;
        await Task.create(taskFields);
        created++;
      } catch (error) {
        console.error('Error creating task:', error);
        errors++;
      }
    }

    setResults({ created, errors, total: previewTasks.length });
    setIsGenerating(false);
    setShowPreview(false);

    // Reload data
    await loadData();
    if (onGenerateComplete) onGenerateComplete();
  };

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
                {clients.length} לקוחות פעילים
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(RECURRING_TASK_TEMPLATES).map(([key, template]) => {
              const Icon = template.icon;
              return (
                <div key={key} className={`p-3 rounded-lg ${template.color} flex items-center gap-2`}>
                  <Icon className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs opacity-70">{template.frequency === 'monthly' ? 'חודשי' : template.frequency === 'bi-monthly' ? 'דו-חודשי' : 'שנתי'}</p>
                  </div>
                </div>
              );
            })}
          </div>

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
        <DialogContent className="sm:max-w-[800px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              תצוגה מקדימה - {previewTasks.length} משימות חדשות
            </DialogTitle>
            <DialogDescription>
              בדוק את המשימות לפני יצירה. משימות שכבר קיימות לא ייווצרו שוב.
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
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {previewTasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                    <Badge className={task.templateColor + ' text-xs'}>
                      {task.templateName}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        יעד: {format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: he })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  onClick={createTasks}
                  disabled={isGenerating}
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
                      צור {previewTasks.length} משימות
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
