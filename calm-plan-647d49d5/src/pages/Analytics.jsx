import React, { useState, useEffect } from "react";
import { Task, TaskSession } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target,
  AlertTriangle,
  Brain,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { he } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [timeframe, setTimeframe] = useState("week");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, sessionsData] = await Promise.all([
        Task.list("-created_date"),
        TaskSession.list("-start_time")
      ]);
      setTasks(tasksData || []);
      setSessions(sessionsData || []);
    } catch (error) {
      console.error("שגיאה בטעינת נתונים:", error);
    }
    setIsLoading(false);
  };

  // ניתוח התנהגויות
  const getProductivityAnalysis = () => {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const plannedCompleted = completedTasks.filter(task => task.was_planned);
    const unplannedCompleted = completedTasks.filter(task => !task.was_planned);
    
    const totalTimeSpent = sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
    const avgProductivity = sessions.length > 0 
      ? sessions.reduce((sum, session) => sum + (session.productivity_rating || 0), 0) / sessions.length 
      : 0;

    const interruptionsCount = sessions.reduce((sum, session) => 
      sum + (session.interruptions?.length || 0), 0);

    return {
      completedTasks: completedTasks.length,
      plannedCompleted: plannedCompleted.length,
      unplannedCompleted: unplannedCompleted.length,
      totalTimeSpent,
      avgProductivity,
      interruptionsCount,
      planningEfficiency: completedTasks.length > 0 ? (plannedCompleted.length / completedTasks.length) * 100 : 0
    };
  };

  // ניתוח זמנים לפי קטגוריות
  const getCategoryTimeAnalysis = () => {
    const categoryData = {};
    
    tasks.forEach(task => {
      const taskSessions = sessions.filter(session => session.task_id === task.id);
      const totalTime = taskSessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
      
      if (!categoryData[task.category]) {
        categoryData[task.category] = {
          name: task.category,
          time: 0,
          count: 0,
          avgProductivity: 0
        };
      }
      
      categoryData[task.category].time += totalTime;
      categoryData[task.category].count += 1;
      
      if (taskSessions.length > 0) {
        const avgProd = taskSessions.reduce((sum, session) => 
          sum + (session.productivity_rating || 0), 0) / taskSessions.length;
        categoryData[task.category].avgProductivity = avgProd;
      }
    });

    return Object.values(categoryData);
  };

  // ניתוח פרודוקטיביות לפי שעות היום
  const getHourlyProductivity = () => {
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      productivity: 0,
      sessions: 0
    }));

    sessions.forEach(session => {
      if (session.start_time && session.productivity_rating) {
        const hour = new Date(session.start_time).getHours();
        hourlyData[hour].productivity += session.productivity_rating;
        hourlyData[hour].sessions += 1;
      }
    });

    return hourlyData.map(data => ({
      ...data,
      productivity: data.sessions > 0 ? data.productivity / data.sessions : 0
    })).filter(data => data.sessions > 0);
  };

  // המלצות לשיפור
  const getRecommendations = () => {
    const analysis = getProductivityAnalysis();
    const recommendations = [];

    if (analysis.planningEfficiency < 70) {
      recommendations.push({
        type: "planning",
        icon: Target,
        title: "שפר את התכנון",
        description: `${analysis.unplannedCompleted} משימות בוצעו ללא תכנון מראש. נסה לתכנן יותר משימות מראש.`,
        priority: "high"
      });
    }

    if (analysis.avgProductivity < 3.5) {
      recommendations.push({
        type: "productivity",
        icon: TrendingUp,
        title: "שפר את הפרודוקטיביות",
        description: "הפרודוקטיביות הממוצעת נמוכה. נסה לזהות גורמי הפרעה ולעבוד בסביבה רגועה יותר.",
        priority: "high"
      });
    }

    if (analysis.interruptionsCount > sessions.length * 2) {
      recommendations.push({
        type: "focus",
        icon: Brain,
        title: "הפחת הפרעות",
        description: "יש הרבה הפרעות במהלך העבודה. נסה לכבות התראות ולעבוד בזמנים מוגדרים.",
        priority: "medium"
      });
    }

    return recommendations;
  };

  const categoryColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  const analysis = getProductivityAnalysis();
  const categoryData = getCategoryTimeAnalysis();
  const hourlyData = getHourlyProductivity();
  const recommendations = getRecommendations();

  return (
    <div className="space-y-8">
      {/* כותרת */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-gray-800">אנליטיקה ותובנות</h1>
        <p className="text-xl text-gray-600">הבן את דפוסי העבודה שלך ושפר את היעילות</p>
      </motion.div>

      {/* סיכום כללי */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Target className="w-5 h-5" />
              יעילות תכנון
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 mb-1">
              {analysis.planningEfficiency.toFixed(0)}%
            </div>
            <p className="text-sm text-green-600">
              {analysis.plannedCompleted} מתוכננות מתוך {analysis.completedTasks}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <BarChart3 className="w-5 h-5" />
              פרודוקטיביות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 mb-1">
              {analysis.avgProductivity.toFixed(1)}/5
            </div>
            <p className="text-sm text-blue-600">ממוצע כללי</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Clock className="w-5 h-5" />
              זמן עבודה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 mb-1">
              {Math.round(analysis.totalTimeSpent / 60)}h
            </div>
            <p className="text-sm text-purple-600">
              {analysis.totalTimeSpent % 60}m נוספות
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              הפרעות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 mb-1">
              {analysis.interruptionsCount}
            </div>
            <p className="text-sm text-orange-600">סך הכל</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* גרפים */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* התפלגות זמן לפי קטגוריות */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>התפלגות זמן לפי קטגוריות</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="time"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} דקות`, 'זמן']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* פרודוקטיביות לפי שעות */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>פרודוקטיביות לפי שעות היום</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip 
                    formatter={(value) => [value.toFixed(1), 'פרודוקטיביות']}
                    labelFormatter={(label) => `שעה ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="productivity" 
                    stroke="#8884d8" 
                    strokeWidth={3}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* המלצות לשיפור */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" />
              המלצות לשיפור היעילות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border-r-4 ${
                    rec.priority === 'high' ? 'border-r-red-500 bg-red-50' :
                    rec.priority === 'medium' ? 'border-r-yellow-500 bg-yellow-50' :
                    'border-r-green-500 bg-green-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <rec.icon className={`w-5 h-5 mt-1 ${
                        rec.priority === 'high' ? 'text-red-600' :
                        rec.priority === 'medium' ? 'text-yellow-600' :
                        'text-green-600'
                      }`} />
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-1">{rec.title}</h3>
                        <p className="text-gray-600">{rec.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">כל הכבוד!</h3>
                <p className="text-gray-600">הביצועים שלך מעולים, המשך כך!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}