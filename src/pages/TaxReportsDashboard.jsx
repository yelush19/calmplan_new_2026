
import React, { useState, useEffect, useMemo } from 'react';
import { Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Calculator, Loader, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import ProcessStatusDashboard from '@/components/dashboards/ProcessStatusDashboard';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const taxCategories = {
  'מע"מ': { label: 'מע"מ', workKey: 'work_vat_reporting' },
  'מקדמות מס': { label: 'מקדמות מס הכנסה', workKey: 'work_tax_advances' },
};

const allCategoryKeys = [
  ...Object.keys(taxCategories),
  ...Object.values(taxCategories).map(c => c.workKey),
];

export default function TaxReportsDashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('process');

  useEffect(() => {
    loadTasks();
  }, [selectedMonth]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const tasksData = await Task.filter({
        due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
      });
      // Filter to only tax-related categories
      setTasks((tasksData || []).filter(t => allCategoryKeys.includes(t.category)));
    } catch (error) {
      console.error("Error loading tax tasks:", error);
    }
    setIsLoading(false);
  };

  const groupedByProcess = useMemo(() => {
    const groups = {};
    Object.entries(taxCategories).forEach(([hebrewKey, config]) => {
      const matchingTasks = tasks.filter(t =>
        t.category === hebrewKey || t.category === config.workKey
      );
      if (matchingTasks.length > 0) {
        groups[config.label] = matchingTasks;
      }
    });
    return groups;
  }, [tasks]);

  const groupedByClient = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const clientName = task.client_name || 'ללא לקוח';
      if (!acc[clientName]) acc[clientName] = [];
      acc[clientName].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [tasks]);

  const handleMonthChange = (direction) => {
    setSelectedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1));
  };

  const statusColors = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-emerald-100 text-emerald-800',
    waiting_for_approval: 'bg-amber-50 text-amber-700',
    waiting_for_materials: 'bg-gray-200 text-gray-600',
    issue: 'bg-amber-100 text-amber-800',
    postponed: 'bg-gray-100 text-gray-500',
    ready_for_reporting: 'bg-teal-50 text-teal-700',
    reported_waiting_for_payment: 'bg-sky-50 text-sky-700',
  };

  const statusLabels = {
    not_started: 'ממתין',
    in_progress: 'בעבודה',
    completed: 'הושלם',
    waiting_for_approval: 'לבדיקה',
    waiting_for_materials: 'ממתין לחומרים',
    issue: 'דורש טיפול',
    postponed: 'נדחה',
    ready_for_reporting: 'מוכן לדיווח',
    reported_waiting_for_payment: 'ממתין לתשלום',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">דיווחי מיסים</h1>
            <p className="text-neutral-medium">מע"מ ומקדמות מס הכנסה - רשות המיסים</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)}
            className="bg-white p-1 rounded-lg shadow-sm">
            <ToggleGroupItem value="process" className="data-[state=on]:bg-purple-50 data-[state=on]:text-purple-700">
              לפי תהליך
            </ToggleGroupItem>
            <ToggleGroupItem value="client" className="data-[state=on]:bg-purple-50 data-[state=on]:text-purple-700">
              לפי לקוח
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-lg w-32 text-center">
              {format(selectedMonth, 'MMMM yyyy', { locale: he })}
            </span>
            <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button onClick={loadTasks} variant="outline" size="icon" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">סה"כ דיווחים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50/50 to-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-xs text-gray-500">התקדמות</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : viewMode === 'process' ? (
        Object.keys(groupedByProcess).length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedByProcess).map(([processName, processTasks], index) => (
              <motion.div key={processName} initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <ProcessStatusDashboard title={processName} tasks={processTasks} />
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">אין דיווחי מיסים לחודש הנבחר</h3>
            <p className="text-gray-500">נסה לבחור חודש אחר או ליצור משימות חוזרות</p>
          </Card>
        )
      ) : (
        Object.keys(groupedByClient).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupedByClient).sort(([a], [b]) => a.localeCompare(b, 'he')).map(([clientName, clientTasks]) => (
              <Card key={clientName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{clientName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {clientTasks.map(task => (
                      <li key={task.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                        <span className="font-medium text-gray-700 text-sm">
                          {taxCategories[task.category]?.label || task.title}
                        </span>
                        <Badge className={statusColors[task.status] || 'bg-gray-100'}>
                          {statusLabels[task.status] || task.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">אין דיווחי מיסים לחודש הנבחר</h3>
          </Card>
        )
      )}
    </div>
  );
}
