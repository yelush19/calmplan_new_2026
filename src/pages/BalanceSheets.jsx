import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Scaling, Search, Calendar, Building, RefreshCw, CheckCircle,
  Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import { Client, Task } from '@/api/entities';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

const statusLabels = {
  not_started: 'לא התחיל',
  in_progress: 'בעבודה',
  waiting_for_materials: 'ממתין לחומרים',
  ready_for_review: 'מוכן לבדיקה',
  completed: 'הושלם'
};

const statusColors = {
  not_started: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  waiting_for_materials: 'bg-yellow-100 text-yellow-800',
  ready_for_review: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800'
};

export default function BalanceSheetsPage() {
  const [clients, setClients] = useState([]);
  const [balanceTasks, setBalanceTasks] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('2024');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchTerm, yearFilter, statusFilter, clients, balanceTasks]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, tasksData] = await Promise.all([
        Client.filter({ status: 'active' }, '-name', 500),
        Task.filter({ category: 'work_annual_reports' }, '-due_date', 500)
      ]);

      setClients(clientsData || []);
      setBalanceTasks(tasksData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const filterClients = () => {
    let filtered = clients.filter(client =>
      client.service_types?.includes('annual_reports')
    );

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Map clients with their balance sheet status
    filtered = filtered.map(client => {
      const clientTask = balanceTasks.find(
        t => t.client_id === client.id && t.title?.includes(yearFilter)
      );

      return {
        ...client,
        balanceStatus: clientTask?.status || 'not_started',
        balanceTask: clientTask
      };
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.balanceStatus === statusFilter);
    }

    setFilteredClients(filtered);
  };

  const getStats = () => {
    const clientsWithBalance = clients.filter(c => c.service_types?.includes('annual_reports'));
    const stats = {
      total: clientsWithBalance.length,
      completed: 0,
      inProgress: 0,
      notStarted: 0
    };

    clientsWithBalance.forEach(client => {
      const task = balanceTasks.find(
        t => t.client_id === client.id && t.title?.includes(yearFilter)
      );

      if (task?.status === 'completed') stats.completed++;
      else if (task?.status === 'in_progress' || task?.status === 'waiting_for_materials') stats.inProgress++;
      else stats.notStarted++;
    });

    return stats;
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">טוען מאזנים...</p>
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
          <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
            <Scaling className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">מעקב מאזנים שנתיים</h1>
            <p className="text-neutral-medium">מעקב אחר הכנת מאזנים שנתיים ללקוחות</p>
          </div>
        </div>

        <Button onClick={loadData} variant="outline">
          <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
          רענן
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Building className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">לקוחות מאזנים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">הושלמו {yearFilter}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">בעבודה</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <div className="text-2xl font-bold">{stats.notStarted}</div>
            <div className="text-sm text-muted-foreground">לא התחילו</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חיפוש לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סנן לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Clients List */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card className="p-12 text-center">
            <Scaling className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו לקוחות</h3>
            <p className="text-gray-500">נסה לשנות את פרמטרי החיפוש.</p>
          </Card>
        ) : (
          filteredClients.map(client => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      {client.balanceTask?.due_date && (
                        <p className="text-sm text-gray-500">
                          יעד: {format(parseISO(client.balanceTask.due_date), 'd בMMM yyyy', { locale: he })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[client.balanceStatus]}>
                      {statusLabels[client.balanceStatus]}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
