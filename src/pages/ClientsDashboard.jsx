
import React, { useState, useEffect, useMemo } from 'react';
import { Client, Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import {
  BarChart3, Calendar, Loader, RefreshCw, Users, Search,
  CheckCircle, Clock, AlertTriangle, Minus, ChevronLeft, ChevronRight,
  Eye, FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';

// Process columns for the board - matching both Hebrew categories (local tasks)
// and work_* categories (Monday.com synced tasks)
const PROCESS_COLUMNS = [
  { key: 'vat', label: 'מע"מ', categories: ['מע"מ', 'work_vat_reporting'], shortLabel: 'מע"מ' },
  { key: 'payroll', label: 'שכר', categories: ['שכר', 'work_payroll'], shortLabel: 'שכר' },
  { key: 'tax_advances', label: 'מקדמות', categories: ['מקדמות מס', 'work_tax_advances'], shortLabel: 'מקדמות' },
  { key: 'social_security', label: 'ביט"ל', categories: ['ביטוח לאומי', 'work_social_security'], shortLabel: 'ביט"ל' },
  { key: 'deductions', label: 'ניכויים', categories: ['ניכויים', 'work_deductions'], shortLabel: 'ניכויים' },
  { key: 'annual_report', label: 'שנתי', categories: ['דוח שנתי'], shortLabel: 'שנתי' },
];

const STATUS_CONFIG = {
  not_started: { label: 'ממתין', color: 'bg-gray-200 text-gray-700', icon: Clock, priority: 3 },
  in_progress: { label: 'בעבודה', color: 'bg-blue-200 text-blue-800', icon: RefreshCw, priority: 2 },
  completed: { label: 'הושלם', color: 'bg-green-200 text-green-800', icon: CheckCircle, priority: 5 },
  postponed: { label: 'נדחה', color: 'bg-neutral-200 text-neutral-700', icon: Minus, priority: 4 },
  waiting_for_approval: { label: 'לבדיקה', color: 'bg-yellow-200 text-yellow-800', icon: Eye, priority: 2 },
  waiting_for_materials: { label: 'ממתין לחומרים', color: 'bg-orange-200 text-orange-800', icon: FileText, priority: 1 },
  issue: { label: 'בעיה', color: 'bg-red-200 text-red-800', icon: AlertTriangle, priority: 0 },
  ready_for_reporting: { label: 'מוכן לדיווח', color: 'bg-purple-200 text-purple-800', icon: FileText, priority: 3 },
  reported_waiting_for_payment: { label: 'ממתין לתשלום', color: 'bg-cyan-200 text-cyan-800', icon: Clock, priority: 4 },
};

const NO_TASK_CONFIG = { label: '-', color: 'bg-gray-50 text-gray-300' };

export default function ClientsDashboardPage() {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const [clientsData, tasksData] = await Promise.all([
        Client.list(null, 500).catch(() => []),
        Task.filter({
          due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }).catch(() => []),
      ]);

      setClients((clientsData || []).filter(c => c.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'he')));
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setIsLoading(false);
  };

  // Build a lookup: clientName -> processKey -> task(s)
  const clientProcessMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      const clientName = task.client_name;
      if (!clientName) return;

      for (const col of PROCESS_COLUMNS) {
        if (col.categories.includes(task.category)) {
          if (!map[clientName]) map[clientName] = {};
          if (!map[clientName][col.key]) map[clientName][col.key] = [];
          map[clientName][col.key].push(task);
          break;
        }
      }
    });
    return map;
  }, [tasks]);

  // Get the "best" (most important) task status for a cell
  const getCellStatus = (clientName, processKey) => {
    const cellTasks = clientProcessMap[clientName]?.[processKey];
    if (!cellTasks || cellTasks.length === 0) return null;

    // Return the task with highest priority (lowest number = most urgent)
    return cellTasks.reduce((best, task) => {
      const bestPriority = STATUS_CONFIG[best.status]?.priority ?? 99;
      const taskPriority = STATUS_CONFIG[task.status]?.priority ?? 99;
      return taskPriority < bestPriority ? task : best;
    }, cellTasks[0]);
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    let result = clients;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(term));
    }

    if (statusFilter !== 'all') {
      result = result.filter(client => {
        const processMap = clientProcessMap[client.name] || {};
        if (statusFilter === 'has_issues') {
          return Object.values(processMap).some(tasks =>
            tasks.some(t => t.status === 'issue' || t.status === 'waiting_for_materials')
          );
        }
        if (statusFilter === 'all_done') {
          const hasTasks = Object.keys(processMap).length > 0;
          return hasTasks && Object.values(processMap).every(tasks =>
            tasks.every(t => t.status === 'completed')
          );
        }
        if (statusFilter === 'in_progress') {
          return Object.values(processMap).some(tasks =>
            tasks.some(t => t.status !== 'completed' && t.status !== 'not_started')
          );
        }
        if (statusFilter === 'not_started') {
          return Object.values(processMap).some(tasks =>
            tasks.some(t => t.status === 'not_started')
          );
        }
        return true;
      });
    }

    return result;
  }, [clients, searchTerm, statusFilter, clientProcessMap]);

  // Summary stats
  const stats = useMemo(() => {
    let totalCells = 0;
    let completed = 0;
    let issues = 0;
    let inProgress = 0;

    clients.forEach(client => {
      const processMap = clientProcessMap[client.name] || {};
      PROCESS_COLUMNS.forEach(col => {
        const cellTasks = processMap[col.key];
        if (cellTasks && cellTasks.length > 0) {
          totalCells++;
          const primaryTask = getCellStatus(client.name, col.key);
          if (primaryTask?.status === 'completed') completed++;
          else if (primaryTask?.status === 'issue' || primaryTask?.status === 'waiting_for_materials') issues++;
          else if (primaryTask?.status !== 'not_started') inProgress++;
        }
      });
    });

    return { totalCells, completed, issues, inProgress, pending: totalCells - completed - issues - inProgress };
  }, [clients, clientProcessMap]);

  const handleMonthChange = (direction) => {
    setSelectedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1));
  };

  const renderStatusCell = (clientName, processKey) => {
    const task = getCellStatus(clientName, processKey);
    if (!task) {
      return (
        <td key={processKey} className="px-2 py-2 text-center">
          <span className="text-gray-300 text-xs">-</span>
        </td>
      );
    }

    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;

    return (
      <td key={processKey} className="px-1 py-1 text-center">
        <button
          onClick={() => setSelectedCell({ clientName, processKey, tasks: clientProcessMap[clientName]?.[processKey] || [] })}
          className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium ${config.color} hover:opacity-80 transition-opacity cursor-pointer min-w-[60px]`}
        >
          {config.label}
        </button>
      </td>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-dark">
              לוח לקוחות
            </h1>
            <p className="text-neutral-medium">מצב תהליכי דיווח לפי לקוח</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-lg w-36 text-center">
            {format(selectedMonth, 'MMMM yyyy', { locale: he })}
          </span>
          <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{filteredClients.length}</div>
            <div className="text-xs text-gray-500">לקוחות פעילים</div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCells}</div>
            <div className="text-xs text-gray-500">משימות בחודש</div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            <div className="text-xs text-gray-500">בעבודה</div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
            <div className="text-xs text-gray-500">בעיות</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חיפוש לקוח..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="סנן לפי מצב" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                <SelectItem value="has_issues">בעיות / ממתין לחומרים</SelectItem>
                <SelectItem value="in_progress">בעבודה</SelectItem>
                <SelectItem value="not_started">טרם התחיל</SelectItem>
                <SelectItem value="all_done">הכל הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Board Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : filteredClients.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 sticky right-0 bg-gray-50 z-10 min-w-[160px]">
                      לקוח
                    </th>
                    {PROCESS_COLUMNS.map(col => (
                      <th key={col.key} className="px-2 py-3 text-center font-semibold text-gray-700 text-sm min-w-[80px]">
                        {col.shortLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, index) => {
                    const processMap = clientProcessMap[client.name] || {};
                    const hasAnyTask = Object.keys(processMap).length > 0;

                    return (
                      <tr
                        key={client.id}
                        className={`border-b hover:bg-gray-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-4 py-2 sticky right-0 bg-inherit z-10">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 text-sm">{client.name}</span>
                            {!hasAnyTask && (
                              <span className="text-xs text-gray-400">(ללא משימות)</span>
                            )}
                          </div>
                        </td>
                        {PROCESS_COLUMNS.map(col => renderStatusCell(client.name, col.key))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">אין לקוחות פעילים להצגה</h3>
          <p className="text-gray-500">הוסף לקוחות פעילים או שנה את הסינון.</p>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 justify-center">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <span key={key} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
            ))}
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-400">
              - (אין משימה)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => { if (!open) setSelectedCell(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedCell?.clientName} - {PROCESS_COLUMNS.find(c => c.key === selectedCell?.processKey)?.label}
            </DialogTitle>
            <DialogDescription>
              {format(selectedMonth, 'MMMM yyyy', { locale: he })}
            </DialogDescription>
          </DialogHeader>
          {selectedCell?.tasks && selectedCell.tasks.length > 0 ? (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {selectedCell.tasks.map(task => {
                const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
                return (
                  <div key={task.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{task.title}</span>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    {task.due_date && (
                      <div className="text-xs text-gray-500">
                        תאריך יעד: {task.due_date}
                      </div>
                    )}
                    {task.description && (
                      <div className="text-xs text-gray-600 whitespace-pre-wrap">
                        {task.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              אין משימות
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
