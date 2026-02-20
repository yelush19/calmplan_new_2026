import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Database, Users, FileText, CheckCircle, AlertTriangle, RefreshCw,
  Calendar, Target, TrendingUp, Clock, Building, BookUser, Monitor,
  Activity, Server, HardDrive
} from 'lucide-react';
import { Client, Task, Event, ServiceProvider, ServiceCompany, Dashboard, AccountReconciliation, ClientAccount, Lead } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SystemOverviewPage() {
  const [stats, setStats] = useState({
    clients: { total: 0, active: 0, loading: true },
    tasks: { total: 0, completed: 0, pending: 0, loading: true },
    events: { total: 0, upcoming: 0, loading: true },
    serviceProviders: { total: 0, companies: 0, loading: true },
    reconciliations: { total: 0, loading: true },
    accounts: { total: 0, loading: true },
    leads: { total: 0, loading: true },
    dashboards: { total: 0, configured: 0, loading: true }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadAllStats();
  }, []);

  const loadAllStats = async () => {
    setIsLoading(true);

    // Load all data in parallel
    const [
      clientsData,
      tasksData,
      eventsData,
      providersData,
      companiesData,
      recsData,
      accountsData,
      leadsData,
      dashboardsData
    ] = await Promise.all([
      Client.list().catch(() => []),
      Task.list().catch(() => []),
      Event.list().catch(() => []),
      ServiceProvider.list().catch(() => []),
      ServiceCompany.list().catch(() => []),
      AccountReconciliation.list().catch(() => []),
      ClientAccount.list().catch(() => []),
      Lead.list().catch(() => []),
      Dashboard.list().catch(() => [])
    ]);

    setStats({
      clients: {
        total: clientsData?.length || 0,
        active: clientsData?.filter(c => c.status === 'active').length || 0,
        potential: clientsData?.filter(c => c.status === 'potential').length || 0,
        loading: false
      },
      tasks: {
        total: tasksData?.length || 0,
        completed: tasksData?.filter(t => t.status === 'completed').length || 0,
        pending: tasksData?.filter(t => ['not_started', 'pending', 'in_progress'].includes(t.status)).length || 0,
        loading: false
      },
      events: {
        total: eventsData?.length || 0,
        upcoming: eventsData?.filter(e => new Date(e.start) > new Date()).length || 0,
        loading: false
      },
      serviceProviders: {
        total: providersData?.length || 0,
        companies: companiesData?.length || 0,
        loading: false
      },
      reconciliations: {
        total: recsData?.length || 0,
        loading: false
      },
      accounts: {
        total: accountsData?.length || 0,
        loading: false
      },
      leads: {
        total: leadsData?.length || 0,
        loading: false
      },
      dashboards: {
        total: dashboardsData?.length || 0,
        configured: dashboardsData?.filter(d => d.monday_board_id).length || 0,
        loading: false
      }
    });

    setLastRefresh(new Date());
    setIsLoading(false);
  };

  const StatCard = ({ title, icon: Icon, value, subValue, subLabel, color, link, loading }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link to={link || '#'}>
        <Card className="hover:shadow-lg transition-all cursor-pointer border-l-4" style={{ borderLeftColor: color }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{title}</p>
                {loading ? (
                  <div className="animate-pulse h-8 w-16 bg-gray-200 rounded" />
                ) : (
                  <>
                    <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                    {subValue !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {subValue} {subLabel}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );

  const getHealthStatus = () => {
    const issues = [];

    if (stats.tasks.pending > 50) {
      issues.push({ text: 'יש הרבה משימות פתוחות', severity: 'warning' });
    }

    if (stats.dashboards.configured === 0) {
      issues.push({ text: 'לא הוגדרו לוחות Monday', severity: 'error' });
    }

    if (stats.clients.active === 0) {
      issues.push({ text: 'אין לקוחות פעילים', severity: 'warning' });
    }

    return issues;
  };

  const healthIssues = getHealthStatus();
  const healthScore = Math.max(0, 100 - (healthIssues.length * 20));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">סקירת מערכת</h1>
            <p className="text-neutral-medium">מצב כללי של כל המערכות</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lastRefresh && (
            <p className="text-sm text-muted-foreground">
              עדכון אחרון: {lastRefresh.toLocaleTimeString('he-IL')}
            </p>
          )}
          <Button onClick={loadAllStats} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </motion.div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            בריאות המערכת
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="text-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke={healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth="12"
                    strokeDasharray={`${healthScore * 3.52} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{healthScore}%</span>
                </div>
              </div>
              <p className="mt-2 font-medium">
                {healthScore >= 80 ? 'מצב תקין' : healthScore >= 50 ? 'דורש תשומת לב' : 'יש בעיות'}
              </p>
            </div>

            <div className="flex-1">
              {healthIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>כל המערכות פועלות תקין</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {healthIssues.map((issue, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                        }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>{issue.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="לקוחות"
          icon={Users}
          value={stats.clients.total}
          subValue={stats.clients.active}
          subLabel="פעילים"
          color="#10b981"
          link={createPageUrl("ClientManagement")}
          loading={stats.clients.loading}
        />
        <StatCard
          title="משימות"
          icon={Target}
          value={stats.tasks.total}
          subValue={stats.tasks.pending}
          subLabel="פתוחות"
          color="#6366f1"
          link={createPageUrl("Tasks")}
          loading={stats.tasks.loading}
        />
        <StatCard
          title="אירועים"
          icon={Calendar}
          value={stats.events.total}
          subValue={stats.events.upcoming}
          subLabel="קרובים"
          color="#f59e0b"
          link={createPageUrl("Calendar")}
          loading={stats.events.loading}
        />
        <StatCard
          title="נותני שירות"
          icon={BookUser}
          value={stats.serviceProviders.total}
          subValue={stats.serviceProviders.companies}
          subLabel="חברות"
          color="#8b5cf6"
          link={createPageUrl("ServiceProviders")}
          loading={stats.serviceProviders.loading}
        />
        <StatCard
          title="התאמות בנק"
          icon={FileText}
          value={stats.reconciliations.total}
          color="#ec4899"
          link={createPageUrl("Reconciliations")}
          loading={stats.reconciliations.loading}
        />
        <StatCard
          title="חשבונות בנק"
          icon={Building}
          value={stats.accounts.total}
          color="#14b8a6"
          link={createPageUrl("ClientManagement")}
          loading={stats.accounts.loading}
        />
        <StatCard
          title="לידים"
          icon={TrendingUp}
          value={stats.leads.total}
          color="#f97316"
          link={createPageUrl("Leads")}
          loading={stats.leads.loading}
        />
        <StatCard
          title="לוחות Monday"
          icon={Database}
          value={stats.dashboards.total}
          subValue={stats.dashboards.configured}
          subLabel="מוגדרים"
          color="#0ea5e9"
          link={createPageUrl("MondayIntegration")}
          loading={stats.dashboards.loading}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>פעולות מהירות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to={createPageUrl("MondayIntegration")}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <RefreshCw className="w-6 h-6" />
                <span>סנכרן Monday</span>
              </Button>
            </Link>
            <Link to={createPageUrl("Tasks")}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Target className="w-6 h-6" />
                <span>משימות חדשות</span>
              </Button>
            </Link>
            <Link to={createPageUrl("ClientManagement")}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Users className="w-6 h-6" />
                <span>הוסף לקוח</span>
              </Button>
            </Link>
            <Link to={createPageUrl("Dashboards")}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>דשבורדים</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            מידע על המערכת
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-muted-foreground mb-1">פלטפורמה</p>
              <p className="font-medium">Base44 + React</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-muted-foreground mb-1">אינטגרציות</p>
              <p className="font-medium">Monday.com</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-muted-foreground mb-1">גרסה</p>
              <p className="font-medium">CalmPlan v1.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
