import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task, Client, Event } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AlertTriangle, CheckCircle, Clock, Calendar, User,
  TrendingDown, TrendingUp, ArrowRight, RefreshCw,
  AlertOctagon, BarChart3, Target
} from 'lucide-react';
import {
  format, parseISO, isValid, startOfWeek, endOfWeek,
  differenceInDays, subWeeks, isWithinInterval, startOfDay
} from 'date-fns';
import { he } from 'date-fns/locale';

export default function WeeklySummary() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState({
    overdueTasks: [],
    completedThisWeek: [],
    failedThisWeek: [],
    upcomingNextWeek: [],
    clientSummary: [],
    stats: { total: 0, completed: 0, overdue: 0, rate: 0 }
  });

  useEffect(() => {
    loadWeeklySummary();
  }, []);

  const loadWeeklySummary = async () => {
    setIsLoading(true);
    try {
      const [tasks, clients] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 500).catch(() => [])
      ]);

      const allTasks = tasks || [];
      const allClients = clients || [];
      const now = new Date();
      const today = startOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
      const lastWeekStart = subWeeks(weekStart, 1);
      const nextWeekEnd = new Date(weekEnd);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

      // All overdue tasks (not completed, past due date, max 180 days old)
      const MAX_OVERDUE_DAYS = 180;
      const overdueTasks = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dueStr = task.due_date || task.scheduled_start;
        if (!dueStr) return false;
        try {
          const dueDate = parseISO(dueStr);
          if (!isValid(dueDate)) return false;
          const daysPast = differenceInDays(today, startOfDay(dueDate));
          return daysPast > 0 && daysPast <= MAX_OVERDUE_DAYS;
        } catch { return false; }
      }).sort((a, b) => {
        const dateA = new Date(a.due_date || a.scheduled_start);
        const dateB = new Date(b.due_date || b.scheduled_start);
        return dateA - dateB;
      });

      // Tasks completed this week
      const completedThisWeek = allTasks.filter(task => {
        if (task.status !== 'completed') return false;
        const completedStr = task.completed_date || task.updated_date;
        if (!completedStr) return false;
        try {
          const completedDate = parseISO(completedStr);
          return isValid(completedDate) && isWithinInterval(completedDate, { start: weekStart, end: weekEnd });
        } catch { return false; }
      });

      // Tasks that were due this week but not completed
      const failedThisWeek = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dueStr = task.due_date || task.scheduled_start;
        if (!dueStr) return false;
        try {
          const dueDate = parseISO(dueStr);
          return isValid(dueDate) && isWithinInterval(startOfDay(dueDate), { start: weekStart, end: weekEnd });
        } catch { return false; }
      });

      // Tasks coming next week
      const nextWeekStart = new Date(weekEnd);
      nextWeekStart.setDate(nextWeekStart.getDate() + 1);
      const upcomingNextWeek = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dueStr = task.due_date || task.scheduled_start;
        if (!dueStr) return false;
        try {
          const dueDate = parseISO(dueStr);
          return isValid(dueDate) && isWithinInterval(startOfDay(dueDate), { start: nextWeekStart, end: nextWeekEnd });
        } catch { return false; }
      }).sort((a, b) => {
        const dateA = new Date(a.due_date || a.scheduled_start);
        const dateB = new Date(b.due_date || b.scheduled_start);
        return dateA - dateB;
      });

      // Client summary - group overdue by client
      const clientMap = {};
      allClients.forEach(c => {
        clientMap[c.id] = c.name;
        if (c.monday_id) clientMap[c.monday_id] = c.name;
      });

      const clientOverdue = {};
      overdueTasks.forEach(task => {
        const clientName = task.client_name ||
          (task.client_id && clientMap[task.client_id]) ||
          'ללא לקוח';
        if (!clientOverdue[clientName]) {
          clientOverdue[clientName] = { name: clientName, tasks: [], maxDaysOverdue: 0 };
        }
        const daysOverdue = differenceInDays(today, parseISO(task.due_date || task.scheduled_start));
        clientOverdue[clientName].tasks.push({ ...task, daysOverdue });
        clientOverdue[clientName].maxDaysOverdue = Math.max(clientOverdue[clientName].maxDaysOverdue, daysOverdue);
      });

      const clientSummary = Object.values(clientOverdue)
        .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);

      const totalActive = allTasks.filter(t => t.status !== 'completed').length;
      const completedTotal = allTasks.filter(t => t.status === 'completed').length;
      const rate = allTasks.length > 0 ? Math.round((completedTotal / allTasks.length) * 100) : 0;

      setData({
        overdueTasks,
        completedThisWeek,
        failedThisWeek,
        upcomingNextWeek,
        clientSummary,
        stats: {
          total: allTasks.length,
          completed: completedTotal,
          overdue: overdueTasks.length,
          rate
        }
      });
    } catch (error) {
      console.error('Error loading weekly summary:', error);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">טוען סיכום שבועי...</p>
        </div>
      </div>
    );
  }

  const weekLabel = `${format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM', { locale: he })} - ${format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM/yyyy', { locale: he })}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          סיכום שבועי
        </h1>
        <p className="text-gray-500">שבוע {weekLabel}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`${data.stats.overdue > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
          <CardContent className="p-4 text-center">
            <AlertOctagon className={`w-8 h-8 mx-auto mb-2 ${data.stats.overdue > 0 ? 'text-red-600' : 'text-green-600'}`} />
            <p className={`text-3xl font-bold ${data.stats.overdue > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {data.stats.overdue}
            </p>
            <p className="text-sm text-gray-600">באיחור</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-3xl font-bold text-green-700">{data.completedThisWeek.length}</p>
            <p className="text-sm text-gray-600">הושלמו השבוע</p>
          </CardContent>
        </Card>

        <Card className={`${data.failedThisWeek.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
          <CardContent className="p-4 text-center">
            <TrendingDown className={`w-8 h-8 mx-auto mb-2 ${data.failedThisWeek.length > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            <p className={`text-3xl font-bold ${data.failedThisWeek.length > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
              {data.failedThisWeek.length}
            </p>
            <p className="text-sm text-gray-600">נפלו השבוע</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-3xl font-bold text-blue-700">{data.upcomingNextWeek.length}</p>
            <p className="text-sm text-gray-600">שבוע הבא</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue by Client - THE MOST IMPORTANT SECTION */}
      {data.clientSummary.length > 0 && (
        <Card className="border-2 border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="w-6 h-6" />
              מה נפל - לפי לקוח ({data.overdueTasks.length} משימות)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.clientSummary.map((client, idx) => (
              <motion.div
                key={client.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border rounded-lg p-4 bg-red-50/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-red-600" />
                    <h4 className="font-bold text-red-800">{client.name}</h4>
                    <Badge variant="destructive">{client.tasks.length} משימות</Badge>
                  </div>
                  <Badge className="bg-red-100 text-red-800">
                    עד {client.maxDaysOverdue} ימי איחור
                  </Badge>
                </div>
                <div className="space-y-2">
                  {client.tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-white border border-red-100">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.daysOverdue > 7 ? 'bg-red-600 animate-pulse' :
                        task.daysOverdue > 3 ? 'bg-red-500' :
                        'bg-orange-500'
                      }`} />
                      <span className="flex-1 text-sm font-medium">{task.title}</span>
                      <span className="text-xs text-red-600">
                        {task.daysOverdue} ימים
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-500">
                          (יעד: {format(parseISO(task.due_date), 'dd/MM', { locale: he })})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.clientSummary.length === 0 && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-green-700 mb-2">
              אין משימות באיחור!
            </h3>
            <p className="text-green-600">כל הכבוד - הכל מעודכן</p>
          </CardContent>
        </Card>
      )}

      {/* Failed this week */}
      {data.failedThisWeek.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-orange-800">
              <Clock className="w-6 h-6" />
              לא הושלמו השבוע ({data.failedThisWeek.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.failedThisWeek.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{task.title}</span>
                    {task.client_name && (
                      <span className="text-xs text-gray-500 mr-2">({task.client_name})</span>
                    )}
                  </div>
                  {task.due_date && (
                    <span className="text-xs text-orange-600">
                      יעד: {format(parseISO(task.due_date), 'dd/MM', { locale: he })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed this week */}
      {data.completedThisWeek.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-green-800">
              <CheckCircle className="w-6 h-6" />
              הושלמו השבוע ({data.completedThisWeek.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.completedThisWeek.map(task => (
                <Badge key={task.id} className="bg-green-100 text-green-800 text-sm py-1 px-3">
                  {task.title}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming next week */}
      {data.upcomingNextWeek.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-blue-800">
              <Calendar className="w-6 h-6" />
              מה מחכה שבוע הבא ({data.upcomingNextWeek.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.upcomingNextWeek.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{task.title}</span>
                    {task.client_name && (
                      <span className="text-xs text-gray-500 mr-2">({task.client_name})</span>
                    )}
                  </div>
                  {task.due_date && (
                    <span className="text-xs text-blue-600">
                      {format(parseISO(task.due_date), 'EEEE dd/MM', { locale: he })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={createPageUrl("Tasks")}>
          <Button variant="outline" className="w-full h-14 text-lg">
            <ArrowRight className="w-5 h-5 ml-2" />
            עבור למשימות
          </Button>
        </Link>
        <Link to={createPageUrl("ClientManagement")}>
          <Button variant="outline" className="w-full h-14 text-lg">
            <ArrowRight className="w-5 h-5 ml-2" />
            עבור ללקוחות
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
