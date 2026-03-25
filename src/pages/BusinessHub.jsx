
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
  RefreshCw,
  CheckCircle,
  Trash2,
  Eye,
} from 'lucide-react';
import { Task, AccountReconciliation, Dashboard } from '@/api/entities';
import { generateProcessTasks, cleanupYearEndOnlyTasks, cleanupP3GhostTasks, dedupTasksForMonth, wipeAllTasksForMonth, previewTaskGeneration, deleteAllStickyNotes } from '@/api/functions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

  const handleCleanupYearEnd = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    try {
      const response = await cleanupYearEndOnlyTasks();
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `נמחקו ${response.data.deleted} משימות שנוצרו בטעות ללקוחות שנתיים בלבד`,
        });
      } else {
        setTaskGenerationResult({ type: 'error', message: response.data.error || 'שגיאה בניקוי' });
      }
    } catch (error) {
      setTaskGenerationResult({ type: 'error', message: 'שגיאה בניקוי משימות' });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleCleanupP3Ghosts = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    try {
      const response = await cleanupP3GhostTasks();
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `נוקו ${response.data.deleted} משימות רפאים מ-P3`,
        });
      } else {
        setTaskGenerationResult({ type: 'error', message: response.data.error || 'שגיאה בניקוי P3' });
      }
    } catch (error) {
      setTaskGenerationResult({ type: 'error', message: 'שגיאה בניקוי משימות P3' });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleDedupTasks = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    try {
      const response = await dedupTasksForMonth({ year: 2026, month: 2 });
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `נמחקו ${response.data.deleted} כפילויות מתוך ${response.data.duplicatesFound} שנמצאו`,
        });
      } else {
        setTaskGenerationResult({ type: 'error', message: response.data.error || 'שגיאה בניקוי כפילויות' });
      }
    } catch (error) {
      setTaskGenerationResult({ type: 'error', message: 'שגיאה בניקוי כפילויות' });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  // ===== WIPE & RESET =====
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const handleWipeAllTasks = async () => {
    setShowWipeConfirm(false);
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    try {
      const response = await wipeAllTasksForMonth({ year: 2026, month: 2 });
      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `🧹 נמחקו ${response.data.deleted} משימות לתקופה 02.2026`,
        });
      } else {
        setTaskGenerationResult({ type: 'error', message: response.data.error || 'שגיאה במחיקה' });
      }
    } catch (error) {
      setTaskGenerationResult({ type: 'error', message: 'שגיאה במחיקת משימות' });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  // ===== AUDIT PREVIEW =====
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditPreview, setAuditPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleShowAudit = async () => {
    setIsLoadingPreview(true);
    setAuditPreview(null);
    try {
      const response = await previewTaskGeneration({ taskType: 'all' });
      if (response.data.success) {
        setAuditPreview(response.data.preview);
        setShowAuditModal(true);
      }
    } catch (error) {
      setTaskGenerationResult({ type: 'error', message: 'שגיאה בטעינת תצוגה מקדימה' });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmGenerate = async () => {
    setShowAuditModal(false);
    await handleGenerateAllTasks();
  };

  const handleGenerateMonthlyReports = async () => {
    setIsGeneratingTasks(true);
    setTaskGenerationResult(null);
    
    try {
      const response = await generateProcessTasks({ taskType: 'monthlyReports' });

      if (response.data.success) {
        setTaskGenerationResult({
          type: 'success',
          message: `נוצרו ${response.data.results.summary.tasksCreated || 0} משימות דיווח חודשיות`,
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
    /* Monday.com integration removed — CalmPlan DNA is the source of truth */
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
    <div className="bg-white p-6">
      <div className="w-full">
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
              <ArrowLeft className="me-2 h-4 w-4" />
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
                : 'bg-amber-50 border-amber-200 text-amber-800'
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
                {/* Monday tasks counter removed — CalmPlan DNA only */}
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
                  <p className="text-sm text-emerald-700">בדיקה מקדימה + יצירה אידמפוטנטית</p>
                </div>
              </div>
              <Button
                onClick={handleShowAudit}
                disabled={isGeneratingTasks || isLoadingPreview}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Eye className={`w-4 h-4 ms-2 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                {isLoadingPreview ? 'טוען תצוגה מקדימה...' : 'תצוגה מקדימה + יצירה'}
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
                  <p className="text-sm text-blue-700">יוצר משימות דיווח חודשיות</p>
                </div>
              </div>
              <Button
                onClick={handleGenerateMonthlyReports}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Calendar className={`w-4 h-4 ms-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                צור דיווחים חודשיים
              </Button>
              <Button
                onClick={handleCleanupYearEnd}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full mt-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                <AlertCircle className={`w-4 h-4 ms-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                ניקוי משימות לקוחות שנתיים
              </Button>
              <Button
                onClick={handleDedupTasks}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full mt-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <AlertCircle className={`w-4 h-4 ms-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                הסר כפילויות 02.2026
              </Button>
              <Button
                onClick={handleCleanupP3Ghosts}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full mt-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <AlertCircle className={`w-4 h-4 ms-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                ניקוי משימות רפאים P3
              </Button>
              <Button
                onClick={async () => {
                  if (!confirm('למחוק את כל הפתקים הדביקים?')) return;
                  const result = await deleteAllStickyNotes();
                  alert(result?.data?.message || 'הושלם');
                  loadData();
                }}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full mt-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <AlertCircle className="w-4 h-4 ms-2" />
                מחק כל הפתקים הדביקים
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white border-amber-200 hover:shadow-lg transition-all duration-300 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-500 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900">מחיקה מלאה 02.2026</h3>
                  <p className="text-sm text-red-700">מוחק את כל המשימות לתקופה ומאפשר יצירה מחדש</p>
                </div>
              </div>
              <Button
                onClick={() => setShowWipeConfirm(true)}
                disabled={isGeneratingTasks}
                variant="outline"
                className="w-full border-red-400 text-red-700 hover:bg-red-100"
              >
                <Trash2 className={`w-4 h-4 ms-2 ${isGeneratingTasks ? 'animate-spin' : ''}`} />
                מחק הכל ואפס 02.2026
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

      {/* Wipe Confirmation Dialog */}
      <AlertDialog open={showWipeConfirm} onOpenChange={setShowWipeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת כל המשימות לתקופה 02.2026</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את כל המשימות שתאריך היעד שלהן בפברואר 2026. לא ניתן לשחזר את הנתונים. האם להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleWipeAllTasks} className="bg-red-600 hover:bg-red-700">
              מחק הכל
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit Preview Modal */}
      <AlertDialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>תצוגה מקדימה - יצירת משימות</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {auditPreview && (
                  <>
                    <p className="font-medium text-foreground">
                      {auditPreview.totalClients} לקוחות פעילים | {auditPreview.existingTasksThisMonth} משימות קיימות לחודש זה
                    </p>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                      {auditPreview.breakdown.vat > 0 && <div>מע"מ: {auditPreview.breakdown.vat}</div>}
                      {auditPreview.breakdown.payroll > 0 && <div>שכר: {auditPreview.breakdown.payroll}</div>}
                      {auditPreview.breakdown.tax_advances > 0 && <div>מקדמות: {auditPreview.breakdown.tax_advances}</div>}
                      {auditPreview.breakdown.social_security > 0 && <div>ביטוח לאומי: {auditPreview.breakdown.social_security}</div>}
                      {auditPreview.breakdown.deductions > 0 && <div>ניכויים: {auditPreview.breakdown.deductions}</div>}
                      {auditPreview.breakdown.reconciliation > 0 && <div>התאמות: {auditPreview.breakdown.reconciliation}</div>}
                    </div>
                    <div className="flex justify-between font-medium text-foreground p-2 bg-emerald-50 rounded-lg">
                      <span>סה"כ צפוי: {auditPreview.totalExpected}</span>
                      <span className="text-emerald-700">חדשות: {auditPreview.newTasks}</span>
                      <span className="text-orange-600">קיימות: {auditPreview.alreadyExist}</span>
                    </div>
                    {auditPreview.newTasks === 0 && (
                      <p className="text-orange-600 font-medium">כל המשימות כבר קיימות - לא ייווצרו כפילויות.</p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate} className="bg-emerald-600 hover:bg-emerald-700">
              {auditPreview?.newTasks === 0 ? 'אין משימות ליצור' : `צור ${auditPreview?.newTasks || 0} משימות`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
