
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Shield, TriangleAlert } from 'lucide-react';
import { Client, Task } from '@/api/entities';
import ClientAuditTool from '@/components/audit/ClientAuditTool';

export default function SystemOverviewPage() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
