
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Shield, TriangleAlert, Users, CheckSquare, Database, Wifi, WifiOff, HardDrive, Clock, CloudUpload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Client, Task } from '@/api/entities';
import { getDataSourceInfo, syncStatus } from '@/api/base44Client';
import ClientAuditTool from '@/components/audit/ClientAuditTool';

function BackupStatusPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

  const configured = !!(
    typeof window !== 'undefined' &&
    (window.__BACKUP_CONFIGURED || true) // Will show setup guide if API returns error
  );

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup-status', {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_CRON_SECRET || ''}` },
      });
      if (res.ok) {
        setStatus(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus({ error: err.error || `HTTP ${res.status}` });
      }
    } catch (e) {
      setStatus({ error: e.message });
    }
    setLoading(false);
  };

  const triggerBackup = async () => {
    setTriggerResult({ running: true });
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_CRON_SECRET || ''}` },
      });
      const data = await res.json();
      setTriggerResult(data);
      if (data.success) fetchStatus(); // Refresh list
    } catch (e) {
      setTriggerResult({ error: e.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">Vercel Cron:</span>
          <Badge variant="outline">כל שעה</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CloudUpload className="w-4 h-4 text-blue-500" />
          <span className="font-medium">יעד:</span>
          <Badge variant="outline">Google Drive / CalmPlan_Backups</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">שמירה:</span>
          <Badge variant="outline">30 יום</Badge>
        </div>
        <div className="flex gap-2 me-auto">
          <Button size="sm" variant="outline" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`w-3 h-3 me-1 ${loading ? 'animate-spin' : ''}`} />
            בדוק סטטוס
          </Button>
          <Button size="sm" variant="outline" onClick={triggerBackup}
            disabled={triggerResult?.running}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <HardDrive className={`w-3 h-3 me-1 ${triggerResult?.running ? 'animate-pulse' : ''}`} />
            {triggerResult?.running ? 'מגבה...' : 'גיבוי ידני'}
          </Button>
        </div>
      </div>

      {/* Status results */}
      {status && !status.error && (
        <div className="bg-white rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-emerald-700">גיבוי אחרון:</span>
            {status.latestBackup ? (
              <>
                <code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono" dir="ltr">
                  {new Date(status.latestBackup.createdTime).toLocaleString('he-IL')}
                </code>
                <Badge variant="outline">{status.latestBackup.sizeKB} KB</Badge>
              </>
            ) : (
              <Badge variant="destructive">אין גיבויים</Badge>
            )}
            <span className="text-xs text-gray-500">
              סה"כ {status.totalBackupCount} קבצים בתיקייה
            </span>
          </div>
          {status.recentBackups?.length > 1 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                {status.recentBackups.length} גיבויים אחרונים
              </summary>
              <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                {status.recentBackups.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-gray-600 font-mono" dir="ltr">
                    <span>{b.name}</span>
                    <span className="text-gray-400">{b.sizeKB} KB</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {status?.error && (
        <Alert variant="destructive" className="py-2">
          <TriangleAlert className="h-3 w-3" />
          <AlertDescription className="text-xs">
            {status.error === 'Unauthorized' ? (
              <span>הגדר <code dir="ltr">VITE_CRON_SECRET</code> ב-Vercel כדי לצפות בסטטוס</span>
            ) : (
              status.error
            )}
          </AlertDescription>
        </Alert>
      )}

      {triggerResult && !triggerResult.running && (
        <Alert variant={triggerResult.success ? 'default' : 'destructive'} className="py-2">
          <AlertDescription className="text-xs">
            {triggerResult.success ? (
              <span>
                גיבוי הושלם: <strong>{triggerResult.backup?.fileName}</strong> ({triggerResult.backup?.sizeKB} KB, {triggerResult.backup?.totalRows} שורות, {triggerResult.elapsedMs}ms)
                {triggerResult.retention?.deletedCount > 0 && (
                  <span className="text-gray-500"> · נמחקו {triggerResult.retention.deletedCount} גיבויים ישנים</span>
                )}
              </span>
            ) : (
              <span>שגיאה: {triggerResult.error}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Setup guide (collapsed) */}
      <details className="text-xs border rounded-lg p-2" style={{ borderColor: 'var(--cp-border)' }}>
        <summary className="cursor-pointer font-bold text-gray-500 hover:text-gray-700">
          הגדרת גיבויים — מדריך Environment Variables
        </summary>
        <div className="mt-2 space-y-1.5 text-gray-600" dir="ltr">
          <p className="font-bold">Required Vercel Environment Variables:</p>
          <div className="bg-gray-50 p-2 rounded font-mono text-[12px] space-y-1">
            <div><span className="text-blue-600">SUPABASE_URL</span> = https://ryivxxdqxexcsxvexkiu.supabase.co</div>
            <div><span className="text-blue-600">SUPABASE_SERVICE_ROLE_KEY</span> = (from Supabase → Settings → API → service_role)</div>
            <div><span className="text-blue-600">GOOGLE_SERVICE_ACCOUNT</span> = (JSON string of service account key)</div>
            <div><span className="text-blue-600">GOOGLE_DRIVE_FOLDER_ID</span> = (folder ID from Drive URL)</div>
            <div><span className="text-blue-600">CRON_SECRET</span> = (random secret string)</div>
            <div><span className="text-purple-600">VITE_CRON_SECRET</span> = (same as CRON_SECRET, for frontend status check)</div>
          </div>
          <p className="font-bold mt-2">Google Setup:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Go to Google Cloud Console → IAM → Service Accounts → Create</li>
            <li>Create a JSON key → copy the entire JSON string</li>
            <li>Create a folder "CalmPlan_Backups" in Google Drive</li>
            <li>Share that folder with the service account email</li>
            <li>Copy the folder ID from the Drive URL</li>
          </ol>
        </div>
      </details>
    </div>
  );
}

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
        <Button onClick={loadData} variant="outline" className="me-auto">
          <RefreshCw className="w-4 h-4 me-2" />
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

      {/* Backup Status */}
      <Card className="border-2 border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="w-5 h-5 text-emerald-500" />
            גיבויים אוטומטיים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BackupStatusPanel />
        </CardContent>
      </Card>

      <Card className="border-2 border-indigo-200 bg-indigo-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-indigo-500" />
            דוח תקינות מערכת-לקוח
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
