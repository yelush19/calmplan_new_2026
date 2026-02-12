
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  DollarSign, 
  Users, 
  BookCheck, 
  FileText,
  Briefcase,
  AlertCircle,
  ArrowLeft,
  Target,
  BarChart3,
  Calendar,
  Monitor,
  Scaling,
  RefreshCw, // Added for new functionality
  CheckCircle // Added for new functionality
} from 'lucide-react';
import { Task, AccountReconciliation, Dashboard } from '@/api/entities';
import { generateProcessTasks } from '@/api/functions'; // Added for new functionality

const StatCard = ({ title, value, icon: Icon, link, isLoading }) => {
  if (isLoading) {
    return <div className="p-6 bg-card rounded-xl shadow-sm animate-pulse h-32"></div>
  }
  
  return (
    <Link to={link}>
      <Card className="bg-card hover:shadow-lg transition-shadow duration-300 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className={`h-5 w-5 text-primary`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-neutral-dark">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
};

const CategoryCard = ({ title, icon: Icon, description, link, stats, urgent, color }) => {
  const colorClasses = {
    primary: 'border-primary hover:bg-primary/5',
    secondary: 'border-secondary hover:bg-secondary/5',
    accent: 'border-accent hover:bg-accent/5',
  };
  const selectedColorClasses = colorClasses[color] || colorClasses.primary;
  
  const iconColorClasses = {
      primary: 'text-primary',
      secondary: 'text-secondary',
      accent: 'text-accent'
  }
  const selectedIconColor = iconColorClasses[color] || iconColorClasses.primary;

  return (
    <Card className={`h-full bg-card transition-all duration-300 border-l-4 rounded-xl shadow-sm ${selectedColorClasses}`}>
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Icon className={`w-7 h-7 ${selectedIconColor}`} />
          <CardTitle className="text-xl text-neutral-dark">{title}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex justify-between items-center pt-0">
        <Badge variant="secondary" className="bg-muted text-muted-foreground">{stats} פריטים</Badge>
        {urgent > 0 && 
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {urgent} דחופים
          </Badge>
        }
      </CardContent>
    </Card>
  );
};

export default function BusinessHubPage() {
  const [businessData, setBusinessData] = useState({
    tasks: [],
    reconciliations: [],
    dashboards: [],
    stats: {
      totalTasks: 0,
      urgentTasks: 0,
      pendingRecons: 0,
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [taskGenerationResult, setTaskGenerationResult] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tasks, recons, dashboards] = await Promise.all([
          Task.filter({ context: 'work', status: { '$ne': 'completed' } }).catch(() => []),
          AccountReconciliation.filter({ status: { '$ne': 'completed' } }).catch(() => []),
          Dashboard.list().catch(() => [])
        ]);
        
        setBusinessData({
          tasks: tasks || [],
          reconciliations: recons || [],
          dashboards: dashboards || [],
          stats: {
            totalTasks: tasks?.length || 0,
            urgentTasks: tasks?.filter(t => t.priority === 'urgent' || t.priority === 'high').length || 0,
            pendingRecons: recons?.length || 0,
          }
        });
      } catch (error) {
        console.error("Error loading business data:", error);
        setBusinessData({
          tasks: [],
          reconciliations: [],
          dashboards: [],
          stats: { totalTasks: 0, urgentTasks: 0, pendingRecons: 0 }
        });
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleGenerateAllTasks = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    
    try {
      const response = await generateProcessTasks({ taskType: 'all' });
      
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: response.data.message,
          details: response.data.results
        });
      } else {
        setTaskGenerationResult({
          type: 'error',
          message: response.data.message || 'שגיאה ביצירת משימות'
        });
      }
    } catch (error) {
      console.error("Error generating tasks:", error);
      setTaskGenerationResult({
        type: 'error',
        message: 'שגיאה בקריאה לפונקציה'
      });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleGenerateMonthlyReports = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    
    try {
      const response = await generateProcessTasks({ taskType: 'mondayReports' });
      
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `נוצרו ${response.data.results.summary.mondayTasksCreated} משימות דיווח חודשיות ב-Monday.com`,
          details: response.data.results
        });
      } else {
        setTaskGenerationResult({
          type: 'error',
          message: response.data.message || 'שגיאה ביצירת משימות דיווח'
        });
      }
    } catch (error) {
      console.error("Error generating monthly reports:", error);
      setTaskGenerationResult({
        type: 'error',
        message: 'שגיאה ביצירת משימות דיווח חודשיות'
      });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const businessCategories = [
    {
      title: "שכר ודיווחים",
      icon: DollarSign,
      color: "primary",
      description: "עיבוד שכר, דיווחי מע״מ, רשויות ומס הכנסה",
      link: createPageUrl("Tasks?context=work&category=payroll"),
      stats: businessData.tasks.filter(t => t.category?.includes('payroll') || t.category?.includes('vat') || t.category?.includes('authorities')).length,
      urgent: businessData.tasks.filter(t => (t.category?.includes('payroll') || t.category?.includes('vat')) && (t.priority === 'urgent' || t.priority === 'high')).length
    },
    {
      title: "לוח התאמות",
      icon: BookCheck,
      color: "secondary",
      description: "התאמת בנקים, אשראי וחשבונות פנימיים",
      link: createPageUrl("Reconciliations"),
      stats: businessData.stats.pendingRecons,
      urgent: businessData.reconciliations.filter(r => r.due_date && new Date(r.due_date) <= new Date(Date.now() + 7*24*60*60*1000)).length
    },
    {
      title: "Monday.com",
      icon: Monitor,
      color: "accent",
      description: "אינטגרציה וסנכרון עם לוחות Monday",
      link: createPageUrl("MondayIntegration"),
      stats: businessData.dashboards?.length || 0,
      urgent: 0
    },
    {
      title: "מעקב מאזנים שנתיים",
      icon: Scaling,
      color: "primary",
      description: "מערכת מעקב דוחות שנתיים מתקדמת",
      link: "#",
      stats: 0,
      urgent: 0,
      external: true
    }
  ];

  const quickActions = [
    {
      title: "מטריצת משימות",
      description: "הצג משימות לפי חשיבות ודחיפות",
      icon: Target,
      link: createPageUrl("TaskMatrix"),
    },
    {
      title: "דשבורדים",
      description: "תצוגות מתקדמות ודוחות",
      icon: BarChart3,
      link: createPageUrl("Dashboards"),
    },
    {
      title: "לוח שנה עסקי",
      description: "אירועים ופגישות עסקיות",
      icon: Calendar,
      link: createPageUrl("Calendar"),
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
              <Briefcase className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">המרכז העסקי</h1>
              <p className="text-muted-foreground">מקום אחד לניהול כל הפעילות העסקית</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to={createPageUrl("Tasks?context=work")}>
              כל המשימות
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
        
        {/* הודעת תוצאת יצירת משימות */}
        {taskGenerationResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border mb-6 mt-6 ${
              taskGenerationResult.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {taskGenerationResult.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{taskGenerationResult.message}</span>
            </div>
            
            {taskGenerationResult.details && taskGenerationResult.type === 'success' && (
              <div className="text-sm">
                <p>משימות CalmPlan: {taskGenerationResult.details.summary.tasksCreated}</p>
                <p>משימות Monday.com: {taskGenerationResult.details.summary.mondayTasksCreated}</p>
                <p>חשבונות סונכרנו: {taskGenerationResult.details.summary.syncedAccounts}</p>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setTaskGenerationResult(null)}
              className="mt-2"
            >
              סגור
            </Button>
          </motion.div>
        )}

        {/* כפתורי פעולות מרכזיות */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-6">
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-100 border-emerald-200 hover:shadow-lg transition-all duration-300 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-500 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-emerald-900">יצירת משימות אוטומטית</h3>
                  <p className="text-sm text-emerald-700">יוצר משימות התאמות, מאזנים ודיווחים</p>
                </div>
              </div>
              <Button 
                onClick={handleGenerateAllTasks}
                disabled={isGeneratingTasks}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <RefreshCw className={`w-4 h-4 ml-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                {isGeneratingTasks ? 'יוצר משימות...' : 'צור כל המשימות'}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 hover:shadow-lg transition-all duration-300 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">דיווחים חודשיים</h3>
                  <p className="text-sm text-blue-700">יוצר משימות דיווח ב-Monday.com</p>
                </div>
              </div>
              <Button 
                onClick={handleGenerateMonthlyReports}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Calendar className={`w-4 h-4 ml-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                צור דיווחים חודשיים
              </Button>
            </CardContent>
          </Card>
        </div>
      
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 md:grid-cols-3"
        >
          <StatCard title="משימות פתוחות" value={businessData.stats.totalTasks} icon={FileText} link={createPageUrl("Tasks?context=work")} isLoading={isLoading} />
          <StatCard title="משימות דחופות" value={businessData.stats.urgentTasks} icon={AlertCircle} link={createPageUrl("Tasks?context=work&priority=urgent")} isLoading={isLoading} />
          <StatCard title="התאמות ממתינות" value={businessData.stats.pendingRecons} icon={BookCheck} link={createPageUrl("Reconciliations")} isLoading={isLoading} />
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
              <h2 className="text-2xl font-semibold">תחומי אחריות</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {businessCategories.map((cat, i) => (
                  <motion.div
                    key={cat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    {cat.external ? (
                      <a href={cat.link} target="_blank" rel="noopener noreferrer" className="block h-full">
                        <CategoryCard {...cat} />
                      </a>
                    ) : (
                      <Link to={cat.link} className="block h-full">
                        <CategoryCard {...cat} />
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">פעולות מהירות</h2>
            <div className="space-y-4">
              {quickActions.map((action, i) => {
                  const cardContent = (
                    <Card className="hover:bg-muted/50 transition-colors rounded-xl shadow-sm">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <action.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-dark">{action.title}</h3>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );

                  return (
                    <motion.div
                      key={action.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                    >
                      {action.external ? (
                        <a href={action.link} target="_blank" rel="noopener noreferrer" className="block">
                          {cardContent}
                        </a>
                      ) : (
                        <Link to={action.link} className="block">
                          {cardContent}
                        </Link>
                      )}
                    </motion.div>
                  );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
