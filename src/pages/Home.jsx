
import React, { useState, useEffect } from "react";
import { Task, Event, User, Dashboard } from "@/api/entities";
import { isToday, isPast, parseISO, format } from "date-fns";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  AlertTriangle, Plus, ArrowRight, Sparkles, Target, User as UserIcon,
  FileBarChart, RefreshCw
} from "lucide-react";
import AggressiveReminderSystem from "@/components/notifications/AggressiveReminderSystem";
import StickyNotes from "@/components/StickyNotes";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
};

export default function HomePage() {
  // New state variables for consolidated tasks and events
  const [tasks, setTasks] = useState({ today: [], overdue: [], upcoming: [], total: 0, completed: 0, completionRate: 0 });
  const [events, setEvents] = useState({ today: [], upcoming: [] });

  // Existing state variables preserved for Quick Stats section
  const [workTasksCount, setWorkTasksCount] = useState(0);
  const [homeTasksCount, setHomeTasksCount] = useState(0);

  // הוספת משתני State כדי שיהיו זמינים בכל הדף
  const [workBoardIds, setWorkBoardIds] = useState([]);
  const [homeBoardIds, setHomeBoardIds] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("משתמש");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get user info
      try {
        const user = await User.me();
        if (user && user.full_name) {
          setUserName(user.full_name.split(" ")[0]);
        }
      } catch (error) {
        console.log("No user data available");
      }

      // 1. קריאת הגדרות הלוחות, בדיוק כמו בדף המשימות
      const boardConfigs = await Dashboard.list() || [];
      const workBoardTypes = ['reports', 'reconciliations', 'client_accounts', 'payroll', 'clients'];
      const homeBoardTypes = ['family_tasks', 'wellbeing'];

      // 2. איסוף כל ה-IDs של הלוחות הרלוונטיים ושמירה ב-State
      const currentWorkBoardIds = boardConfigs
        .filter(config => workBoardTypes.includes(config.type) && config.monday_board_id)
        .map(config => config.monday_board_id);
      setWorkBoardIds(currentWorkBoardIds); // Update state

      const currentHomeBoardIds = boardConfigs
        .filter(config => homeBoardTypes.includes(config.type) && config.monday_board_id)
        .map(config => config.monday_board_id);
      setHomeBoardIds(currentHomeBoardIds); // Update state

      const allRelevantBoardIds = [...currentWorkBoardIds, ...currentHomeBoardIds];

      // 3. קריאה למשימות ולאירועים - סינון מראש לפי monday_board_id
      const [tasksData, eventsData] = await Promise.all([
        allRelevantBoardIds.length > 0 ? Task.filter({
          'monday_board_id': { '$in': allRelevantBoardIds }
        }, "-created_date", 2000).catch(() => []) : Promise.resolve([]),
        Event.list("-start_date", 1000).catch(() => []),
      ]);

      const rawTasks = Array.isArray(tasksData) ? tasksData : [];

      // סינון משימות ישנות: הושלמו לפני 60+ יום או תקועות 180+ יום
      const nowMs = Date.now();
      const allTasks = rawTasks.filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 60) return false;
        if (task.status !== 'completed' && daysSince > 180) return false;
        return true;
      });

      // 4. חלוקת המשימות לפי קונטקסט לספירה נכונה - שימוש במשתנים המקומיים
      const workTasks = allTasks.filter(task => task.monday_board_id && currentWorkBoardIds.includes(task.monday_board_id));
      const homeTasks = allTasks.filter(task => task.monday_board_id && currentHomeBoardIds.includes(task.monday_board_id));

      setWorkTasksCount(workTasks.length);
      setHomeTasksCount(homeTasks.length);

      // --- המשך הלוגיקה הקיימת לעיבוד התאריכים ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const todayTasks = allTasks.filter(task => {
        // 🔧 תיקון: בודק גם due_date וגם scheduled_start
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime();
        } catch(e) {
            return false;
        }
      });

      const overdueTasksList = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(23, 59, 59, 999); // Compare against end of day for overdue
            return taskDate < today;
        } catch(e) {
            return false;
        }
      });

      const upcomingTasks = allTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dateString = task.due_date || task.scheduled_start;
        if (!dateString) return false;
        try {
            const taskDate = parseISO(dateString);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate >= tomorrow && taskDate <= nextWeek;
        } catch(e) {
            return false;
        }
      }).sort((a, b) => {
          const dateA = new Date(a.due_date || a.scheduled_start);
          const dateB = new Date(b.due_date || b.scheduled_start);
          return dateA - dateB;
      });

      const allEvents = Array.isArray(eventsData) ? eventsData : [];

      const todayEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime();
      });

      const upcomingEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= tomorrow && eventDate <= nextWeek;
      }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setTasks({
        today: todayTasks,
        overdue: overdueTasksList,
        upcoming: upcomingTasks,
        total: totalTasks,
        completed: completedTasks,
        completionRate
      });

      setEvents({
        today: todayEvents,
        upcoming: upcomingEvents
      });


    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Greeting */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2"
      >
        <h1 className="text-4xl font-bold text-gray-800">
          {getGreeting()}, {userName}!
        </h1>
        <p className="text-xl text-gray-600">
          {format(new Date(), 'EEEE, d בMMMM yyyy')}
        </p>
      </motion.div>

      {/* Aggressive Reminder System - Safety Net */}
      <AggressiveReminderSystem />

      {/* Quick Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Link to={createPageUrl("Tasks?context=work")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Briefcase className="w-6 h-6 text-blue-600" />
                <span className="text-2xl font-bold text-blue-600">{workTasksCount}</span>
              </div>
              <p className="text-blue-800 font-medium">משימות עבודה</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("Tasks?context=home")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <HomeIcon className="w-6 h-6 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{homeTasksCount}</span>
              </div>
              <p className="text-green-800 font-medium">משימות בית</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("Calendar")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-purple-200 bg-purple-50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                <span className="text-2xl font-bold text-purple-600">{events.today.length}</span>
              </div>
              <p className="text-purple-800 font-medium">אירועים היום</p>
            </CardContent>
          </Card>
        </Link>

        <Card className={`border-2 ${tasks.overdue.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className={`w-6 h-6 ${tasks.overdue.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              <span className={`text-2xl font-bold ${tasks.overdue.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {tasks.overdue.length}
              </span>
            </div>
            <p className={`font-medium ${tasks.overdue.length > 0 ? 'text-amber-800' : 'text-gray-600'}`}>
              ממתינות לטיפול
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Today's Focus */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <Target className="w-6 h-6 text-blue-600" />
                הפוקוס שלך להיום
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.today.length === 0 && events.today.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    יום פנוי! 🎉
                  </h3>
                  <p className="text-gray-500 mb-4">
                    אין משימות או אירועים מתוכננים להיום
                  </p>
                  <Link to={createPageUrl("Tasks")}>
                    <Button>
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף משימה חדשה
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Today's Events */}
                  {events.today.map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg bg-purple-50 border-purple-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-purple-800">{event.title}</h4>
                          {event.description && (
                            <p className="text-sm text-purple-600 mt-1">{event.description}</p>
                          )}
                        </div>
                        <div className="text-sm text-purple-700">
                          {format(parseISO(event.start_date), 'HH:mm')}
                          {event.end_date && ` - ${format(parseISO(event.end_date), 'HH:mm')}`}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Today's Tasks */}
                  {tasks.today.map((task) => (
                    <div key={task.id} className={`p-3 border rounded-lg ${
                      task.monday_board_id && workBoardIds.includes(task.monday_board_id) ? 'bg-blue-50 border-blue-200' :
                      task.monday_board_id && homeBoardIds.includes(task.monday_board_id) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className={`font-semibold ${
                            task.monday_board_id && workBoardIds.includes(task.monday_board_id) ? 'text-blue-800' :
                            task.monday_board_id && homeBoardIds.includes(task.monday_board_id) ? 'text-green-800' : 'text-gray-800'
                          }`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className={`text-sm mt-1 ${
                              task.monday_board_id && workBoardIds.includes(task.monday_board_id) ? 'text-blue-600' :
                              task.monday_board_id && homeBoardIds.includes(task.monday_board_id) ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {task.priority === 'urgent' ? 'דחוף' :
                               task.priority === 'high' ? 'גבוה' :
                               task.priority === 'medium' ? 'בינוני' : 'נמוך'}
                            </Badge>
                            {task.estimated_duration && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {task.estimated_duration} דק'
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Link to={createPageUrl("Tasks")}>
                    <Button variant="outline" className="w-full mt-4">
                      <ArrowRight className="w-4 h-4 ml-2" />
                      ראה את כל המשימות
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Overdue Tasks */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <Clock className="w-6 h-6 text-amber-600" />
                ממתינות לטיפול
                {tasks.overdue.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">{tasks.overdue.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.overdue.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                  <h3 className="text-lg font-semibold text-emerald-700 mb-2">
                    כל כך נחמד! 👏
                  </h3>
                  <p className="text-emerald-600">
                    אין משימות ממתינות
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.overdue.slice(0, 5).map((task) => (
                    <div key={task.id} className="p-3 border rounded-lg bg-amber-50 border-amber-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-800">{task.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              {Math.ceil((new Date() - parseISO(task.due_date || task.scheduled_start)) / (1000 * 60 * 60 * 24))} ימים
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <UserIcon className="w-3 h-3" />
                              {task.monday_board_id && workBoardIds.includes(task.monday_board_id) ? 'עבודה' :
                               task.monday_board_id && homeBoardIds.includes(task.monday_board_id) ? 'בית' : 'כללי'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {tasks.overdue.length > 5 && (
                    <p className="text-sm text-amber-600 text-center">
                      ועוד {tasks.overdue.length - 5} משימות ממתינות...
                    </p>
                  )}

                  <Link to={createPageUrl("Tasks")}>
                    <Button variant="outline" className="w-full mt-4 border-amber-200 text-amber-700 hover:bg-amber-50">
                      <ArrowRight className="w-4 h-4 ml-2" />
                      צפה במשימות
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Sticky Notes */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="shadow-sm border-amber-200/50 bg-amber-50/20">
          <CardContent className="p-4">
            <StickyNotes compact={true} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Link to={createPageUrl("WeeklyPlanningDashboard")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-3 text-blue-600" />
              <h3 className="font-semibold text-blue-800 mb-2">תכנון שבועי</h3>
              <p className="text-sm text-blue-600">תכנן את השבוע שלך</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("ClientManagement")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6 text-center">
              <UserIcon className="w-8 h-8 mx-auto mb-3 text-green-600" />
              <h3 className="font-semibold text-green-800 mb-2">ניהול לקוחות</h3>
              <p className="text-sm text-green-600">הוסף ונהל לקוחות</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("Calendar")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-3 text-purple-600" />
              <h3 className="font-semibold text-purple-800 mb-2">לוח שנה</h3>
              <p className="text-sm text-purple-600">ראה כל הפגישות</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("WeeklySummary")}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6 text-center">
              <FileBarChart className="w-8 h-8 mx-auto mb-3 text-orange-600" />
              <h3 className="font-semibold text-orange-800 mb-2">סיכום שבועי</h3>
              <p className="text-sm text-orange-600">מה נפל? מה הושלם?</p>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    </motion.div>
  );
}
