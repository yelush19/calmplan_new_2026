import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar, Clock, AlertTriangle, CheckCircle, Target,
  Brain, TrendingUp, Users, Home, Briefcase
} from 'lucide-react';
import { Task, Client, Dashboard } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, addDays, startOfWeek, parseISO, isValid, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

export default function WeeklyPlanningDashboard() {
  const [thisWeekData, setThisWeekData] = useState({});
  const [nextWeekData, setNextWeekData] = useState({});
  const [overdueCount, setOverdueCount] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWeeklyData();
  }, []);

  const loadWeeklyData = async () => {
    setIsLoading(true);

    const today = new Date();
    const todayStart = startOfDay(today);
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const nextWeekStart = addDays(thisWeekStart, 7);

    try {
      const [allTasks, clients] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.filter({ status: 'active' }).catch(() => [])
      ]);

      // סינון משימות ישנות: הושלמו 60+ יום או תקועות 180+ יום
      const nowMs = Date.now();
      const tasks = (allTasks || []).filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 60) return false;
        if (task.status !== 'completed' && daysSince > 180) return false;
        return true;
      });

      // Filter tasks by week
      const thisWeekTasks = filterTasksByWeek(tasks, thisWeekStart);
      const nextWeekTasks = filterTasksByWeek(tasks, nextWeekStart);

      // Overdue tasks
      const overdue = tasks.filter(t => {
        if (t.status === 'completed') return false;
        const dateStr = t.due_date || t.scheduled_start;
        if (!dateStr) return false;
        try {
          const d = parseISO(dateStr);
          return isValid(d) && startOfDay(d) < todayStart;
        } catch { return false; }
      });
      setOverdueCount(overdue.length);

      const completedThisWeek = thisWeekTasks.filter(t => t.status === 'completed').length;

      setThisWeekData({
        start: thisWeekStart,
        tasks: thisWeekTasks,
        completed: completedThisWeek,
        workload: calculateWorkload(thisWeekTasks)
      });

      setNextWeekData({
        start: nextWeekStart,
        tasks: nextWeekTasks,
        completed: nextWeekTasks.filter(t => t.status === 'completed').length,
        workload: calculateWorkload(nextWeekTasks)
      });

      setRecommendations(generateSmartRecommendations(thisWeekTasks, nextWeekTasks, clients || [], overdue));

    } catch (error) {
      console.error('Error loading weekly data:', error);
    }

    setIsLoading(false);
  };

  const filterTasksByWeek = (tasks, weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    return tasks.filter(t => {
      const dateStr = t.due_date || t.scheduled_start;
      if (!dateStr) return false;
      return dateStr >= weekStartStr && dateStr <= weekEndStr;
    });
  };

  const calculateWorkload = (tasks) => {
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.status === 'overdue').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    let level = 'light';
    if (urgentTasks > 5 || totalTasks > 20) level = 'heavy';
    else if (urgentTasks > 2 || totalTasks > 10) level = 'moderate';

    return { level, urgentTasks, totalTasks, completedTasks };
  };

  const generateSmartRecommendations = (thisWeek, nextWeek, clients, overdue) => {
    const recommendations = [];

    // Overdue tasks warning
    if (overdue.length > 0) {
      recommendations.push({
        type: 'overdue',
        priority: 'high',
        title: 'משימות באיחור',
        message: `${overdue.length} משימות עברו את תאריך היעד. טפל בהן או עדכן תאריכים.`,
        icon: AlertTriangle
      });
    }

    // Tasks without deadline
    const noDeadlineTasks = [...thisWeek, ...nextWeek].filter(t => !t.due_date);
    if (noDeadlineTasks.length > 0) {
      recommendations.push({
        type: 'deadline',
        priority: 'high',
        title: 'הוסף תאריכי יעד',
        message: `${noDeadlineTasks.length} משימות ללא תאריך יעד. הוסף תאריכים ספציפיים.`,
        icon: Target
      });
    }

    // Heavy workload
    const thisWeekUrgent = thisWeek.filter(t => t.priority === 'urgent').length;
    if (thisWeekUrgent > 3) {
      recommendations.push({
        type: 'workload',
        priority: 'high',
        title: 'עומס דחוף גבוה',
        message: `${thisWeekUrgent} משימות דחופות השבוע. שקול לדחות משימות פחות חשובות.`,
        icon: AlertTriangle
      });
    }

    // Achievability check
    const workDays = 5;
    const avgTasksPerDay = thisWeek.length / workDays;
    if (avgTasksPerDay > 4) {
      recommendations.push({
        type: 'balance',
        priority: 'medium',
        title: 'חלוקה מחדש מומלצת',
        message: `ממוצע ${Math.round(avgTasksPerDay)} משימות ליום. שקול חלוקה מחדש.`,
        icon: TrendingUp
      });
    }

    // Seasonal planning
    const currentMonth = new Date().getMonth();
    if ([11, 0, 1].includes(currentMonth)) {
      recommendations.push({
        type: 'seasonal',
        priority: 'low',
        title: 'תכנון חורפי',
        message: 'חורף = זמן מאזנים שנתיים ותכנון לשנה הבאה.',
        icon: Brain
      });
    }

    return recommendations;
  };

  const WorkloadIndicator = ({ workload }) => {
    const colors = {
      light: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      heavy: 'bg-red-100 text-red-800'
    };

    const labels = {
      light: 'נמוך',
      moderate: 'בינוני',
      heavy: 'גבוה'
    };

    return (
      <Badge className={colors[workload.level]}>
        עומס {labels[workload.level]}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">מכין תכנון שבועי חכם...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          דשבורד תכנון שבועי חכם
        </h1>
        <p className="text-gray-600">
          תצוגה מרוכזת של השבוע הנוכחי והבא עם המלצות S.M.A.R.T
        </p>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{overdueCount} משימות באיחור!</strong>{' '}
            <Link to={createPageUrl("Tasks")} className="underline">
              עבור לעמוד המשימות לטיפול
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* SMART Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Brain className="w-5 h-5" />
              המלצות S.M.A.R.T לשבוע
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, i) => (
              <Alert key={i} className="border-amber-200">
                <rec.icon className="w-4 h-4" />
                <AlertDescription>
                  <strong>{rec.title}:</strong> {rec.message}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Weekly Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* This Week */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                השבוע הנוכחי
              </div>
              <WorkloadIndicator workload={thisWeekData.workload} />
            </CardTitle>
            <p className="text-sm text-gray-500">
              {format(thisWeekData.start, 'dd/MM')} - {format(addDays(thisWeekData.start, 6), 'dd/MM')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">סה"כ משימות</p>
                <p className="text-2xl font-bold">{thisWeekData.tasks?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">הושלמו</p>
                <p className="text-2xl font-bold text-green-600">{thisWeekData.completed || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">דחופות</p>
                <p className="text-2xl font-bold text-red-600">
                  {thisWeekData.workload?.urgentTasks || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500">באיחור</p>
                <p className="text-2xl font-bold text-orange-600">{overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Week */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                השבוע הבא
              </div>
              <WorkloadIndicator workload={nextWeekData.workload} />
            </CardTitle>
            <p className="text-sm text-gray-500">
              {format(nextWeekData.start, 'dd/MM')} - {format(addDays(nextWeekData.start, 6), 'dd/MM')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">סה"כ משימות</p>
                <p className="text-2xl font-bold">{nextWeekData.tasks?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">הושלמו</p>
                <p className="text-2xl font-bold text-green-600">{nextWeekData.completed || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">דחופות</p>
                <p className="text-2xl font-bold text-red-600">
                  {nextWeekData.workload?.urgentTasks || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500">ממתינות</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(nextWeekData.tasks?.length || 0) - (nextWeekData.completed || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>פעולות מהירות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to={createPageUrl("Tasks")}>
              <Button variant="outline" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                כל המשימות
              </Button>
            </Link>
            <Link to={createPageUrl("ClientManagement")}>
              <Button variant="outline" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                ניהול לקוחות
              </Button>
            </Link>
            <Link to={createPageUrl("Calendar")}>
              <Button variant="outline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                לוח שנה
              </Button>
            </Link>
            <Link to={createPageUrl("WeeklySummary")}>
              <Button variant="outline" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                סיכום שבועי
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
