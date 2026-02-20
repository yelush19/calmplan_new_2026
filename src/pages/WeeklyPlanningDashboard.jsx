import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain, Calendar, CheckCircle, Clock, Target, TrendingUp,
  AlertCircle, RefreshCw, ChevronRight, Users, Briefcase, Home
} from 'lucide-react';
import { Task, Client, Event } from '@/api/entities';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const priorityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

const priorityLabels = {
  high: 'דחוף',
  medium: 'רגיל',
  low: 'נמוך'
};

const categoryIcons = {
  work: Briefcase,
  home: Home,
  personal: Users
};

export default function WeeklyPlanningDashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, clientsData, eventsData] = await Promise.all([
        Task.filter({}, '-due_date', 500),
        Client.filter({ status: 'active' }, null, 200),
        Event.filter({}, '-start', 100)
      ]);

      setTasks(tasksData || []);
      setClients(clientsData || []);
      setEvents(eventsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  // Filter tasks for current week
  const weekTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = parseISO(task.due_date);
    return isWithinInterval(dueDate, { start: weekStart, end: weekEnd });
  });

  // Group tasks by day
  const tasksByDay = {};
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayKey = format(day, 'yyyy-MM-dd');
    tasksByDay[dayKey] = {
      date: day,
      tasks: weekTasks.filter(task => task.due_date === dayKey)
    };
  }

  // Calculate stats
  const stats = {
    total: weekTasks.length,
    completed: weekTasks.filter(t => t.status === 'completed').length,
    inProgress: weekTasks.filter(t => t.status === 'in_progress').length,
    pending: weekTasks.filter(t => ['not_started', 'pending'].includes(t.status)).length,
    overdue: weekTasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return parseISO(t.due_date) < new Date();
    }).length
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Get urgent tasks (high priority or overdue)
  const urgentTasks = weekTasks.filter(t =>
    t.priority === 'high' ||
    (t.due_date && parseISO(t.due_date) < new Date() && t.status !== 'completed')
  ).slice(0, 5);

  // Get tasks by client
  const tasksByClient = weekTasks.reduce((acc, task) => {
    if (task.client_id) {
      if (!acc[task.client_id]) acc[task.client_id] = [];
      acc[task.client_id].push(task);
    }
    return acc;
  }, {});

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'לקוח לא ידוע';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">טוען דשבורד שבועי...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">דשבורד שבועי חכם</h1>
            <p className="text-neutral-medium">
              {format(weekStart, 'd בMMM', { locale: he })} - {format(weekEnd, 'd בMMM yyyy', { locale: he })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            שבוע קודם
          </Button>
          <Button
            variant="outline"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          >
            השבוע
          </Button>
          <Button
            variant="outline"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            שבוע הבא
          </Button>
          <Button onClick={loadData} variant="ghost" size="icon">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">משימות השבוע</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">הושלמו</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">בביצוע</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="text-sm text-muted-foreground">באיחור</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{completionRate}%</div>
            <div className="text-sm text-muted-foreground">אחוז השלמה</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            התקדמות שבועית
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>משימות שהושלמו</span>
              <span>{stats.completed} מתוך {stats.total}</span>
            </div>
            <Progress value={completionRate} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Urgent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                משימות דחופות
              </div>
              <Link to={createPageUrl("Tasks")}>
                <Button variant="ghost" size="sm">
                  צפה בכל
                  <ChevronRight className="w-4 h-4 mr-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urgentTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>אין משימות דחופות</p>
              </div>
            ) : (
              <div className="space-y-3">
                {urgentTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      {task.client_id && (
                        <p className="text-sm text-gray-500">{getClientName(task.client_id)}</p>
                      )}
                    </div>
                    <Badge className={priorityColors[task.priority || 'medium']}>
                      {priorityLabels[task.priority || 'medium']}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                משימות לפי לקוח
              </div>
              <Link to={createPageUrl("ClientManagement")}>
                <Button variant="ghost" size="sm">
                  ניהול לקוחות
                  <ChevronRight className="w-4 h-4 mr-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(tasksByClient).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Briefcase className="w-12 h-12 mx-auto mb-2" />
                <p>אין משימות משויכות ללקוחות השבוע</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(tasksByClient).slice(0, 5).map(([clientId, clientTasks]) => {
                  const completed = clientTasks.filter(t => t.status === 'completed').length;
                  return (
                    <div key={clientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{getClientName(clientId)}</p>
                          <p className="text-sm text-gray-500">
                            {completed}/{clientTasks.length} הושלמו
                          </p>
                        </div>
                      </div>
                      <Progress value={(completed / clientTasks.length) * 100} className="w-20 h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            תצוגת שבוע
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Object.entries(tasksByDay).map(([dayKey, { date, tasks: dayTasks }]) => {
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const completedCount = dayTasks.filter(t => t.status === 'completed').length;

              return (
                <div
                  key={dayKey}
                  className={`p-3 rounded-lg border ${isToday ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                >
                  <div className="text-center mb-2">
                    <p className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-gray-600'}`}>
                      {format(date, 'EEEE', { locale: he })}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                      {format(date, 'd')}
                    </p>
                  </div>

                  <div className="text-center">
                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-gray-400">אין משימות</p>
                    ) : (
                      <div>
                        <p className="text-sm font-medium">{dayTasks.length} משימות</p>
                        <p className="text-xs text-gray-500">{completedCount} הושלמו</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to={createPageUrl("Tasks")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">ניהול משימות</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("Calendar")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="font-medium">לוח שנה</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("ClientManagement")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="font-medium">לקוחות</p>
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl("Dashboards")}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <p className="font-medium">דשבורדים</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
