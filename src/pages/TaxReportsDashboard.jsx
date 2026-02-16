
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  Calculator, Loader, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, Check, AlertTriangle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TAX_SERVICES,
  ADDITIONAL_SERVICES,
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
} from '@/config/processTemplates';

// All services shown on the tax dashboard
const taxDashboardServices = {
  ...TAX_SERVICES,
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'tax')
  ),
};

const allTaxCategories = Object.values(taxDashboardServices).flatMap(s => s.taskCategories);

// Core services get their own table (they have meaningful steps)
const CORE_SERVICES = ['vat', 'tax_advances'];

export default function TaxReportsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));

  useEffect(() => { loadData(); }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const [tasksData, clientsData] = await Promise.all([
        Task.filter({
          due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }),
        Client.list(null, 500).catch(() => []),
      ]);
      setTasks((tasksData || []).filter(t => allTaxCategories.includes(t.category)));
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading tax tasks:", error);
    }
    setIsLoading(false);
  };

  // Lookup client by name for tax IDs
  const clientByName = useMemo(() => {
    const map = {};
    clients.forEach(c => { map[c.name] = c; });
    return map;
  }, [clients]);

  const filteredTasks = useMemo(() => {
    if (!clientFilter) return tasks;
    return tasks.filter(t => t.client_name === clientFilter);
  }, [tasks, clientFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  // Build data per service: { serviceKey: { service, clientRows: [{clientName, task, client}] } }
  const serviceData = useMemo(() => {
    const result = {};
    Object.values(taxDashboardServices).forEach(service => {
      const serviceTasks = filteredTasks.filter(t => service.taskCategories.includes(t.category));
      if (serviceTasks.length > 0) {
        result[service.key] = {
          service,
          clientRows: serviceTasks
            .map(task => ({
              clientName: task.client_name || 'ללא לקוח',
              task,
              client: clientByName[task.client_name] || null,
            }))
            .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he')),
        };
      }
    });
    return result;
  }, [filteredTasks, clientByName]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    let totalSteps = 0, doneSteps = 0;
    filteredTasks.forEach(task => {
      const service = getServiceForTask(task);
      if (service) {
        const steps = task.process_steps || {};
        totalSteps += service.steps.length;
        doneSteps += service.steps.filter(s => steps[s.key]?.done).length;
      }
    });
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0, totalSteps, doneSteps, stepsPct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0 };
  }, [filteredTasks]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    try {
      await Task.update(task.id, { process_steps: updatedSteps });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
    } catch (error) { console.error("Error updating step:", error); }
  }, []);

  const handleDateChange = useCallback(async (task, stepKey, newDate) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = { ...currentSteps, [stepKey]: { ...currentSteps[stepKey], date: newDate } };
    try {
      await Task.update(task.id, { process_steps: updatedSteps });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
    } catch (error) { console.error("Error updating date:", error); }
  }, []);

  const handleMonthChange = (dir) => {
    setSelectedMonth(c => dir === 'prev' ? subMonths(c, 1) : addMonths(c, 1));
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-slate-600 text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-white/20 rounded-full p-0.5 ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">דיווחי מיסים</h1>
            <p className="text-gray-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[10px] text-gray-400 leading-none">חודש דיווח</div>
              <div className="font-semibold text-sm text-gray-700">
                {format(selectedMonth, 'MMMM yyyy', { locale: he })}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">סה"כ דיווחים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-gray-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-xs text-gray-500">דיווחים שהושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-sky-700">{stats.stepsPct}%</div>
            <div className="text-xs text-gray-500">שלבים ({stats.doneSteps}/{stats.totalSteps})</div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : Object.keys(serviceData).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(serviceData).map(([serviceKey, { service, clientRows }]) => (
            <ServiceTable
              key={serviceKey}
              service={service}
              clientRows={clientRows}
              onToggleStep={handleToggleStep}
              onDateChange={handleDateChange}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-gray-200">
          <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">אין דיווחי מיסים לחודש הנבחר</h3>
          <p className="text-gray-500">נסה לבחור חודש אחר או ליצור משימות חוזרות</p>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// SERVICE TABLE - Compact grid, one row per client
// =====================================================

function ServiceTable({ service, clientRows, onToggleStep, onDateChange }) {
  const completedCount = clientRows.filter(r => r.task.status === 'completed').length;

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* Table header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-800">{service.label}</h2>
          <span className="text-xs text-gray-500">{completedCount}/{clientRows.length} הושלמו</span>
        </div>
        <div className="w-24 bg-gray-200 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${clientRows.length > 0 ? Math.round((completedCount / clientRows.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right py-2 px-4 font-semibold text-gray-600 text-xs bg-gray-50/50 sticky right-0 z-10 min-w-[140px]">
                לקוח
              </th>
              {service.steps.map(step => (
                <th key={step.key} className="text-center py-2 px-2 font-medium text-gray-500 text-[11px] bg-gray-50/50 min-w-[80px]">
                  {step.label}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium text-gray-500 text-[11px] bg-gray-50/50 min-w-[80px]">
                סטטוס
              </th>
            </tr>
          </thead>
          <tbody>
            {clientRows.map(({ clientName, task, client }, idx) => (
              <ClientRow
                key={task.id}
                clientName={clientName}
                task={task}
                client={client}
                service={service}
                isEven={idx % 2 === 0}
                onToggleStep={onToggleStep}
                onDateChange={onDateChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Get relevant tax IDs for a service type
function getTaxIds(client, serviceKey) {
  if (!client) return [];
  const ids = [];
  const ti = client.tax_info || {};
  const annual = ti.annual_tax_ids || {};

  switch (serviceKey) {
    case 'vat':
      if (ti.vat_file_number) ids.push({ label: 'תיק מע"מ', value: ti.vat_file_number });
      break;
    case 'tax_advances':
      if (client.entity_number) ids.push({ label: 'ח"פ', value: client.entity_number });
      if (annual.tax_advances_id) ids.push({ label: 'מקדמות', value: annual.tax_advances_id });
      if (annual.tax_advances_percentage) ids.push({ label: '%', value: annual.tax_advances_percentage });
      break;
    default:
      if (client.entity_number) ids.push({ label: 'ח"פ', value: client.entity_number });
  }
  return ids;
}

function ClientRow({ clientName, task, client, service, isEven, onToggleStep, onDateChange }) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const allDone = service.steps.every(s => steps[s.key]?.done);
  const taxIds = getTaxIds(client, service.key);

  return (
    <tr className={`border-b border-gray-50 transition-colors ${allDone ? 'bg-emerald-50/40' : isEven ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-100/50`}>
      {/* Client name + tax IDs */}
      <td className={`py-1.5 px-4 sticky right-0 z-10 ${allDone ? 'bg-emerald-50/40' : isEven ? 'bg-white' : 'bg-gray-50/30'}`}>
        <span className="truncate block max-w-[200px] font-medium text-gray-800 text-xs">{clientName}</span>
        {taxIds.length > 0 && (
          <div className="flex gap-2 mt-0.5">
            {taxIds.map(({ label, value }) => (
              <span key={label} className="text-[10px] text-gray-400">
                <span className="font-medium">{label}:</span> {value}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Step cells */}
      {service.steps.map(stepDef => {
        const stepData = steps[stepDef.key] || { done: false, date: null };
        return (
          <td key={stepDef.key} className="py-1.5 px-2 text-center">
            <StepCell
              stepData={stepData}
              onToggle={() => onToggleStep(task, stepDef.key)}
              onDateChange={(date) => onDateChange(task, stepDef.key, date)}
            />
          </td>
        );
      })}

      {/* Status badge */}
      <td className="py-1.5 px-3 text-center">
        <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0.5 font-semibold`}>
          {statusCfg.label}
        </Badge>
      </td>
    </tr>
  );
}

// =====================================================
// STEP CELL - Compact clickable cell in the grid
// =====================================================

function StepCell({ stepData, onToggle, onDateChange }) {
  const [editingDate, setEditingDate] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (!stepData.done) {
    // Empty cell - click to mark done
    return (
      <button
        onClick={onToggle}
        className="w-8 h-8 mx-auto rounded-md border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center group"
      >
        <Check className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
      </button>
    );
  }

  // Completed cell - green with date
  return (
    <Popover open={editingDate} onOpenChange={setEditingDate}>
      <PopoverTrigger asChild>
        <button
          className="w-full mx-auto flex flex-col items-center gap-0 group"
        >
          <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center shadow-sm group-hover:bg-emerald-600 transition-colors">
            <Check className="w-4 h-4 text-white" />
          </div>
          {stepData.date && (
            <span className="text-[9px] text-emerald-600 font-medium mt-0.5 leading-none">
              {formatDate(stepData.date)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="center" side="top">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">תאריך ביצוע:</label>
            <input
              type="date"
              value={stepData.date || ''}
              onChange={(e) => {
                onDateChange(e.target.value);
                setEditingDate(false);
              }}
              className="block w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-red-500 hover:text-red-700 hover:border-red-300"
            onClick={() => { onToggle(); setEditingDate(false); }}
          >
            בטל סימון
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
