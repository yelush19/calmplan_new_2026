
import React, { useState, useEffect, useMemo } from 'react';
import { Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Loader, RefreshCw, Users, Briefcase } from 'lucide-react';
import ProcessStatusDashboard from '@/components/dashboards/ProcessStatusDashboard';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from '@/components/ui/badge';

// Payroll processes ONLY - tax processes (VAT, tax advances) are in TaxReportsDashboard
const processCategories = {
  'work_payroll': 'שכר',
  'work_social_security': 'ביטוח לאומי',
  'work_deductions': 'ניכויים',
  'שכר': 'שכר',
  'ביטוח לאומי': 'ביטוח לאומי',
  'ניכויים': 'ניכויים',
};

const statusTranslations = {
  not_started: 'ממתין',
  in_progress: 'בעבודה',
  completed: 'הושלם',
  postponed: 'נדחה',
  waiting_for_approval: 'לבדיקה',
  waiting_for_materials: 'ממתין לחומרים',
  issue: 'בעיה',
  ready_for_reporting: 'מוכן לדיווח',
  reported_waiting_for_payment: 'ממתין לתשלום'
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


export default function PayrollDashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('process'); // 'process' or 'client'
  
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
        category: { 'in': Object.keys(processCategories) }
      });
      setTasks(tasksData || []);
    } catch (error) {
      console.error("Error loading tasks for dashboard:", error);
    }
    setIsLoading(false);
  };
  
  const groupedByProcess = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const processName = processCategories[task.category];
      if (processName) {
        if (!acc[processName]) {
          acc[processName] = [];
        }
        acc[processName].push(task);
      }
      return acc;
    }, {});
  }, [tasks]);

  const groupedByClient = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const clientName = task.client_name || 'ללא לקוח';
      if (!acc[clientName]) {
        acc[clientName] = [];
      }
      acc[clientName].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const handleMonthChange = (direction) => {
    setSelectedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1));
  };
  
  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">
                    תהליכי שכר
                </h1>
                <p className="text-neutral-medium">שכר, ביטוח לאומי וניכויים - לקוחות עם שירותי שכר</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
             <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value)} className="bg-white p-1 rounded-lg shadow-sm">
                <ToggleGroupItem value="process" aria-label="לפי תהליך" className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <Briefcase className="h-4 w-4 mr-2" />
                  לפי תהליך
                </ToggleGroupItem>
                <ToggleGroupItem value="client" aria-label="לפי לקוח" className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <Users className="h-4 w-4 mr-2" />
                  לפי לקוח
                </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
                    &gt;
                </Button>
                <span className="font-semibold text-lg w-32 text-center">
                    {format(selectedMonth, 'MMMM yyyy', { locale: he })}
                </span>
                <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
                    &lt;
                </Button>
                <Button onClick={loadTasks} variant="outline" size="icon" disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
      </motion.div>

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
          <Card className="p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו תהליכים לחודש הנבחר</h3>
            <p className="text-gray-500">נסה לבחור חודש אחר או להפעיל את סנכרון המשימות מ-Monday.com</p>
          </Card>
        )
      ) : ( // Client View
        Object.keys(groupedByClient).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedByClient).sort(([a], [b]) => a.localeCompare(b, 'he')).map(([clientName, clientTasks]) => (
              <Card key={clientName}>
                <CardHeader>
                  <CardTitle>{clientName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {clientTasks.map(task => (
                      <li key={task.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                        <span className="font-medium text-gray-700">{processCategories[task.category] || task.title}</span>
                        <Badge className={`${statusColors[task.status] || 'bg-gray-200'}`}>{statusTranslations[task.status] || task.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לקוחות עם משימות דיווח לחודש זה</h3>
            <p className="text-gray-500">נסה לבחור חודש אחר או להפעיל את סנכרון המשימות.</p>
          </Card>
        )
      )}
    </div>
  );
}
