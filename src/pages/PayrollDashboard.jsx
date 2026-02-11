
import React, { useState, useEffect, useMemo } from 'react';
import { Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Loader, RefreshCw, Users, Briefcase, ChevronLeft, ChevronRight, ArrowRight, X } from 'lucide-react';
import ProcessStatusDashboard from '@/components/dashboards/ProcessStatusDashboard';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Payroll processes ONLY - tax processes (VAT, tax advances) are in TaxReportsDashboard
const processCategories = {
  'work_payroll': 'שכר',
  'work_social_security': 'ביטוח לאומי',
  'work_deductions': 'ניכויים',
  'שכר': 'שכר',
  'ביטוח לאומי': 'ביטוח לאומי',
  'ניכויים': 'ניכויים',
};

const statusColors = {
  not_started: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-emerald-200 text-emerald-900',
  completed: 'bg-emerald-400 text-white',
  waiting_for_approval: 'bg-amber-200 text-amber-900',
  waiting_for_materials: 'bg-amber-100 text-amber-800',
  issue: 'bg-amber-300 text-amber-900',
  postponed: 'bg-gray-300 text-gray-600',
  ready_for_reporting: 'bg-teal-200 text-teal-900',
  reported_waiting_for_payment: 'bg-sky-200 text-sky-900',
};

const statusLabels = {
  not_started: 'ממתין',
  in_progress: 'בעבודה',
  completed: 'הושלם',
  postponed: 'נדחה',
  waiting_for_approval: 'לבדיקה',
  waiting_for_materials: 'ממתין לחומרים',
  issue: 'דורש טיפול',
  ready_for_reporting: 'מוכן לדיווח',
  reported_waiting_for_payment: 'ממתין לתשלום'
};

export default function PayrollDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1)); // Default to reporting month (previous)
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
        context: 'work',
        due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        category: { '$in': Object.keys(processCategories) }
      });
      setTasks(tasksData || []);
    } catch (error) {
      console.error("Error loading tasks for dashboard:", error);
    }
    setIsLoading(false);
  };

  // Apply client filter
  const filteredTasks = useMemo(() => {
    if (!clientFilter) return tasks;
    return tasks.filter(t => t.client_name === clientFilter);
  }, [tasks, clientFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  const groupedByProcess = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      const processName = processCategories[task.category];
      if (processName) {
        if (!acc[processName]) {
          acc[processName] = [];
        }
        acc[processName].push(task);
      }
      return acc;
    }, {});
  }, [filteredTasks]);

  const groupedByClient = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      const clientName = task.client_name || 'ללא לקוח';
      if (!acc[clientName]) {
        acc[clientName] = [];
      }
      acc[clientName].push(task);
      return acc;
    }, {});
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [filteredTasks]);

  const handleMonthChange = (direction) => {
    setSelectedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back to board + Client filter banner */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />
            חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-gray-600 text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />
            {clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-white/20 rounded-full p-0.5 ml-1">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-md">
                <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    תהליכי שכר
                </h1>
                <p className="text-gray-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | שכר, ביט"ל וניכויים</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
             <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value)} className="bg-white p-1 rounded-lg shadow-sm border border-gray-200">
                <ToggleGroupItem value="process" aria-label="לפי תהליך" className="data-[state=on]:bg-gray-100 data-[state=on]:text-gray-700">
                  <Briefcase className="h-4 w-4 mr-2" />
                  לפי תהליך
                </ToggleGroupItem>
                <ToggleGroupItem value="client" aria-label="לפי לקוח" className="data-[state=on]:bg-gray-100 data-[state=on]:text-gray-700">
                  <Users className="h-4 w-4 mr-2" />
                  לפי לקוח
                </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="text-center w-32">
                  <div className="text-[10px] text-gray-400 leading-none">חודש דיווח</div>
                  <div className="font-semibold text-sm text-gray-700">
                    {format(selectedMonth, 'MMMM yyyy', { locale: he })}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
            </div>
            <Button onClick={loadTasks} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">סה"כ תהליכים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200 shadow-sm">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(groupedByProcess).map(([processName, processTasks], index) => (
              <motion.div
                key={processName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ProcessStatusDashboard title={processName} tasks={processTasks} />
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-gray-200">
            <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו תהליכי שכר לחודש הנבחר</h3>
            <p className="text-gray-500">נסה לבחור חודש אחר או להפעיל את סנכרון המשימות מ-Monday.com</p>
          </Card>
        )
      ) : (
        Object.keys(groupedByClient).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupedByClient).sort(([a], [b]) => a.localeCompare(b, 'he')).map(([clientName, clientTasks]) => (
              <Card key={clientName} className="border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{clientName}</span>
                    <Link to={createPageUrl('ClientsDashboard')}>
                      <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-emerald-600 gap-1">
                        <ArrowRight className="w-3 h-3" />
                        לוח
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {clientTasks.map(task => (
                      <li key={task.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700 text-sm">{processCategories[task.category] || task.title}</span>
                        <Badge className={`${statusColors[task.status] || 'bg-gray-200'} text-xs font-semibold`}>{statusLabels[task.status] || task.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-gray-200">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לקוחות עם משימות שכר לחודש זה</h3>
            <p className="text-gray-500">נסה לבחור חודש אחר או להפעיל את סנכרון המשימות.</p>
          </Card>
        )
      )}
    </div>
  );
}
