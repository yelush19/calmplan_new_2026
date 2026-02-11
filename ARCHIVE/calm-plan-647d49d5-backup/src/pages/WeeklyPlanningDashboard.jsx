import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar, Clock, AlertTriangle, CheckCircle, Target, 
  Brain, TrendingUp, Users, Home, Briefcase, Heart
} from 'lucide-react';
import { Task, WeeklySchedule, Client } from '@/api/entities';
import { format, addDays, startOfWeek, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

export default function WeeklyPlanningDashboard() {
  const [thisWeekData, setThisWeekData] = useState({});
  const [nextWeekData, setNextWeekData] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWeeklyData();
  }, []);

  const loadWeeklyData = async () => {
    setIsLoading(true);
    
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const nextWeekStart = addDays(thisWeekStart, 7);
    
    try {
      // Load tasks for both weeks
      const [thisWeekTasks, nextWeekTasks, treatments, clients] = await Promise.all([
        getWeekTasks(thisWeekStart),
        getWeekTasks(nextWeekStart), 
        WeeklySchedule.filter({ 
          weekStartDate: format(thisWeekStart, 'yyyy-MM-dd'),
          status: 'active' 
        }),
        Client.filter({ status: 'active' })
      ]);

      setThisWeekData({
        start: thisWeekStart,
        tasks: thisWeekTasks,
        treatments: treatments[0]?.fixedBlocks || [],
        workload: calculateWorkload(thisWeekTasks, treatments[0]?.fixedBlocks || [])
      });

      setNextWeekData({
        start: nextWeekStart,
        tasks: nextWeekTasks,
        treatments: [],
        workload: calculateWorkload(nextWeekTasks, [])
      });

      // Generate SMART recommendations
      setRecommendations(generateSmartRecommendations(thisWeekTasks, nextWeekTasks, clients));
      
    } catch (error) {
      console.error('Error loading weekly data:', error);
    }
    
    setIsLoading(false);
  };

  const getWeekTasks = async (weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    
    const tasks = await Task.filter({
      due_date: {
        '>=': format(weekStart, 'yyyy-MM-dd'),
        '<=': format(weekEnd, 'yyyy-MM-dd')
      }
    });
    
    return tasks || [];
  };

  const calculateWorkload = (tasks, treatments) => {
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.status === 'overdue').length;
    const totalTasks = tasks.length;
    const treatmentHours = treatments.reduce((sum, t) => {
      const start = new Date(`1970-01-01T${t.startTime}`);
      const end = new Date(`1970-01-01T${t.endTime}`);
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);
    
    let level = 'light';
    if (urgentTasks > 5 || totalTasks > 20 || treatmentHours > 15) level = 'heavy';
    else if (urgentTasks > 2 || totalTasks > 10 || treatmentHours > 8) level = 'moderate';
    
    return { level, urgentTasks, totalTasks, treatmentHours };
  };

  const generateSmartRecommendations = (thisWeek, nextWeek, clients) => {
    const recommendations = [];
    
    // SMART: Specific - בדוק משימות ללא תאריך יעד
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

    // SMART: Measurable - בדוק עומס
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

    // SMART: Achievable - בדוק יתכנות
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

    // SMART: Relevant - התאם לעונות
    const currentMonth = new Date().getMonth();
    if ([11, 0, 1].includes(currentMonth)) { // חורף
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
                <p className="text-gray-500">משימות</p>
                <p className="text-2xl font-bold">{thisWeekData.tasks?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">טיפולים</p>
                <p className="text-2xl font-bold">{thisWeekData.treatments?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">דחופות</p>
                <p className="text-2xl font-bold text-red-600">
                  {thisWeekData.workload?.urgentTasks || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500">שעות טיפול</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round(thisWeekData.workload?.treatmentHours || 0)}
                </p>
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
                <p className="text-gray-500">משימות</p> 
                <p className="text-2xl font-bold">{nextWeekData.tasks?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">טיפולים</p>
                <p className="text-2xl font-bold">{nextWeekData.treatments?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">דחופות</p>
                <p className="text-2xl font-bold text-red-600">
                  {nextWeekData.workload?.urgentTasks || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500">שעות טיפול</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round(nextWeekData.workload?.treatmentHours || 0)}
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
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              הוסף טיפול
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              משימת עבודה
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              משימת בית
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              פעילות אישית
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}