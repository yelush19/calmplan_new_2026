
import React, { useState, useEffect } from 'react';
import { Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

const statusTranslations = {
  not_started: 'ממתין לתחילת עבודה',
  in_progress: 'בעבודה',
  completed: 'דווח ושולם',
  postponed: 'נדחה',
  cancelled: 'בוטל',
  waiting_for_approval: 'לבדיקה',
  waiting_for_materials: 'ממתין לחומרים',
  issue: 'בעיה',
  ready_for_reporting: 'מוכן לדיווח',
  reported_waiting_for_payment: 'ממתין לתשלום'
};

const categoryTranslations = {
  work_payroll: "שכר",
  work_vat_reporting: "מע\"מ",
  work_tax_advances: "מקדמות מס",
  work_deductions: "ניכויים",
  work_social_security: "ביטוח לאומי",
  work_authorities: "רשויות",
  work_client_management: "ניהול לקוח",
  work_reconciliation: "התאמות",
  work_admin: "אדמיניסטרציה",
};

const statusColors = {
  not_started: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  waiting_for_approval: 'bg-yellow-100 text-yellow-800',
  waiting_for_materials: 'bg-orange-100 text-orange-800',
  issue: 'bg-red-100 text-red-800',
  ready_for_reporting: 'bg-purple-100 text-purple-800',
  reported_waiting_for_payment: 'bg-cyan-100 text-cyan-800',
  postponed: 'bg-gray-200 text-gray-700'
};

export default function ClientTasksTab({ clientId, clientName }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClientTasks();
  }, [clientId]);

  const loadClientTasks = async () => {
    setIsLoading(true);
    try {
      // FIX: Increased read limit
      const clientTasks = await Task.filter({ client_id: clientId }, null, 500);
      setTasks(clientTasks || []);
    } catch (error) {
      console.error("Error loading client tasks:", error);
      setTasks([]);
    }
    setIsLoading(false);
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = statusFilter === 'all' || task.status === statusFilter;
    const searchMatch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return statusMatch && searchMatch;
  });

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'not_started').length;
    
    return { total, completed, inProgress, pending };
  };

  const stats = getTaskStats();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">טוען משימות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm text-muted-foreground">סה"כ משימות</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">הושלמו</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">בביצוע</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">ממתינות</div>
          </CardContent>
        </Card>
      </div>

      {/* פילטרים */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            סינון משימות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חפש משימה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סנן לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(statusTranslations).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* רשימת משימות */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              {tasks.length === 0 
                ? `אין משימות עבור ${clientName}`
                : 'לא נמצאו משימות תואמות'
              }
            </h3>
            <p className="text-gray-500">
              {tasks.length === 0 
                ? 'כשתיווצרנה משימות חדשות עבור הלקוח, הן יופיעו כאן.'
                : 'נסה לשנות את פרמטרי החיפוש.'
              }
            </p>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{task.title}</h4>
                      <Badge className={statusColors[task.status]}>
                        {statusTranslations[task.status]}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 mb-3">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      {task.category && (
                        <Badge variant="outline">
                          {categoryTranslations[task.category] || task.category}
                        </Badge>
                      )}
                      {task.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>יעד: {format(parseISO(task.due_date), 'd בMMM yyyy', { locale: he })}</span>
                        </div>
                      )}
                      {task.estimated_duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{task.estimated_duration} דק'</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.external_app_link && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(task.external_app_link, '_blank')}
                    >
                      פתח ב-Monday
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
