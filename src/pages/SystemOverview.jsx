
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Shield, TriangleAlert, Users, CheckSquare, Database, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Client, Task } from '@/api/entities';
import { getDataSourceInfo, syncStatus } from '@/api/base44Client';
import ClientAuditTool from '@/components/audit/ClientAuditTool';

export default function SystemOverviewPage() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.filter({}, '-updated_date', 1000),
        Task.filter({}, '-updated_date', 2000)
      ]);
      setClients(clientsData);
      setTasks(tasksData);
      // Get diagnostic info after data loads
      try { setDataSource(getDataSourceInfo()); } catch { /* ignore */ }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('שגיאה בטעינת נתונים: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">מצב המערכת</h1>
          <p className="text-gray-600">ביקורת נתונים ובדיקת תקינות לקוחות</p>
        </div>
        <Button onClick={loadData} variant="outline" className="mr-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          רענן
        </Button>
      </div>

      {/* Connection diagnostic */}
      {dataSource && (
        <Card className={`border-2 ${dataSource.supabaseConfigured && !dataSource.rlsBlocked ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                {dataSource.supabaseConfigured ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium">מקור נתונים:</span>
                <Badge variant={dataSource.supabaseConfigured ? 'default' : 'destructive'}>
                  {dataSource.source === 'supabase' ? 'Supabase (ענן)' : 'localStorage (מקומי)'}
                </Badge>
              </div>
              {dataSource.supabaseUrl && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">URL:</span>
                  <code className="text-xs bg-white px-2 py-0.5 rounded border font-mono" dir="ltr">
                    {dataSource.supabaseUrl}
                  </code>
                </div>
              )}
              {dataSource.rlsBlocked && (
                <Badge variant="destructive" className="animate-pulse">
                  RLS חוסם קריאה — הרץ fix-rls.sql
                </Badge>
              )}
              {!dataSource.supabaseConfigured && (
                <Badge variant="destructive">
                  VITE_SUPABASE_URL ריק — בדוק Vercel Env Vars
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data summary bar */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">לקוחות:</span>
          <Badge variant={clients.length > 0 ? 'default' : 'destructive'}>{clients.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">משימות:</span>
          <Badge variant={tasks.length > 0 ? 'default' : 'destructive'}>{tasks.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">פעילים:</span>
          <Badge variant="outline">{clients.filter(c => c.status === 'active').length}</Badge>
        </div>
      </div>

      {/* Warning when 0 clients + Supabase not configured */}
      {clients.length === 0 && dataSource && !dataSource.supabaseConfigured && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Supabase לא מחובר!</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              המערכת פועלת ב-localStorage בלבד כי <code dir="ltr">VITE_SUPABASE_URL</code> ריק.
            </p>
            <p className="font-semibold">פעולה נדרשת:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-sm">
              <li dir="ltr">Go to Vercel → Project Settings → Environment Variables</li>
              <li dir="ltr">Set <code>VITE_SUPABASE_URL</code> = <code>https://ryivxxdqxexcsxvexkiu.supabase.co</code></li>
              <li dir="ltr">Set <code>VITE_SUPABASE_ANON_KEY</code> = your anon key from Supabase Dashboard → Settings → API</li>
              <li dir="ltr">Redeploy (Vercel → Deployments → Redeploy)</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning when 0 clients + RLS blocked */}
      {clients.length === 0 && dataSource?.rlsBlocked && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>RLS חוסם גישה לנתונים!</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Supabase מחובר אבל Row Level Security חוסם קריאת נתונים.
              הנתונים קיימים בטבלה אבל לא מוצגים.
            </p>
            <p className="font-semibold">פעולה נדרשת:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-sm">
              <li dir="ltr">Go to Supabase Dashboard → SQL Editor</li>
              <li dir="ltr">Paste the contents of <code>fix-rls.sql</code> (in the project root)</li>
              <li dir="ltr">Click Run</li>
              <li>רענן את הדף — הנתונים אמורים להופיע</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>שגיאה!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-2 border-indigo-200 bg-indigo-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-indigo-500" />
            ביקורת מיפוי לקוח-מערכת
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClientAuditTool
            clients={clients}
            tasks={tasks}
            onRefresh={loadData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
