
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  Calculator, Loader, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, Check, AlertTriangle, Calendar as CalendarIcon,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  getStepCompletionPercent,
} from '@/config/processTemplates';

// All services shown on the tax dashboard
const taxDashboardServices = {
  ...TAX_SERVICES,
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'tax')
  ),
};

const allTaxCategories = Object.values(taxDashboardServices).flatMap(s => s.taskCategories);

export default function TaxReportsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1));
  const [viewMode, setViewMode] = useState('steps'); // 'steps' | 'process' | 'client'
  const [expandedClients, setExpandedClients] = useState({});

  useEffect(() => {
    loadTasks();
  }, [selectedMonth]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const tasksData = await Task.filter({
        due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
      });
      setTasks((tasksData || []).filter(t => allTaxCategories.includes(t.category)));
    } catch (error) {
      console.error("Error loading tax tasks:", error);
    }
    setIsLoading(false);
  };

  const filteredTasks = useMemo(() => {
    if (!clientFilter) return tasks;
    return tasks.filter(t => t.client_name === clientFilter);
  }, [tasks, clientFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  // Group tasks by client, then by service
  const clientGroups = useMemo(() => {
    const groups = {};
    filteredTasks.forEach(task => {
      const clientName = task.client_name || 'ללא לקוח';
      if (!groups[clientName]) groups[clientName] = [];
      groups[clientName].push(task);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'he'));
  }, [filteredTasks]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Steps stats
    let totalSteps = 0;
    let doneSteps = 0;
    filteredTasks.forEach(task => {
      const service = getServiceForTask(task);
      if (service) {
        const steps = task.process_steps || {};
        totalSteps += service.steps.length;
        doneSteps += service.steps.filter(s => steps[s.key]?.done).length;
      }
    });
    const stepsPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

    return { total, completed, pct, totalSteps, doneSteps, stepsPct };
  }, [filteredTasks]);

  // Alerts - clients missing critical steps
  const alerts = useMemo(() => {
    const result = [];
    clientGroups.forEach(([clientName, clientTasks]) => {
      clientTasks.forEach(task => {
        const service = getServiceForTask(task);
        if (!service || task.status === 'completed' || task.status === 'not_relevant') return;
        const steps = task.process_steps || {};
        service.steps.forEach(step => {
          if (!steps[step.key]?.done) {
            result.push({
              clientName,
              serviceName: service.label,
              stepLabel: step.label,
              taskId: task.id,
              stepKey: step.key,
            });
          }
        });
      });
    });
    return result;
  }, [clientGroups]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    try {
      await Task.update(task.id, { process_steps: updatedSteps });
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, process_steps: updatedSteps } : t
      ));
    } catch (error) {
      console.error("Error updating step:", error);
    }
  }, []);

  const handleDateChange = useCallback(async (task, stepKey, newDate) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = {
      ...currentSteps,
      [stepKey]: { ...currentSteps[stepKey], date: newDate },
    };
    try {
      await Task.update(task.id, { process_steps: updatedSteps });
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, process_steps: updatedSteps } : t
      ));
    } catch (error) {
      console.error("Error updating date:", error);
    }
  }, []);

  const handleMonthChange = (direction) => {
    setSelectedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1));
  };

  const toggleClientExpand = (clientName) => {
    setExpandedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back + Client filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />
            חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-slate-600 text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />
            {clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-white/20 rounded-full p-0.5 ml-1">
              <X className="w-3 h-3" />
            </button>
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
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)}
            className="bg-white p-1 rounded-lg shadow-sm border border-gray-200">
            <ToggleGroupItem value="steps" className="data-[state=on]:bg-slate-100 data-[state=on]:text-slate-700 text-xs px-2">
              מעקב שלבים
            </ToggleGroupItem>
            <ToggleGroupItem value="client" className="data-[state=on]:bg-slate-100 data-[state=on]:text-slate-700 text-xs px-2">
              לפי לקוח
            </ToggleGroupItem>
          </ToggleGroup>
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
          <Button onClick={loadTasks} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
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
            <div className="text-xs text-gray-500">שלבים שהושלמו ({stats.doneSteps}/{stats.totalSteps})</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && viewMode === 'steps' && (
        <AlertsSection alerts={alerts} />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : clientGroups.length > 0 ? (
        viewMode === 'steps' ? (
          <StepsView
            clientGroups={clientGroups}
            expandedClients={expandedClients}
            onToggleExpand={toggleClientExpand}
            onToggleStep={handleToggleStep}
            onDateChange={handleDateChange}
          />
        ) : (
          <ClientListView clientGroups={clientGroups} />
        )
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
// ALERTS SECTION
// =====================================================

function AlertsSection({ alerts }) {
  const [showAll, setShowAll] = useState(false);

  // Group alerts by step type for summary
  const alertsByStep = {};
  alerts.forEach(a => {
    const key = `${a.serviceName}: ${a.stepLabel}`;
    if (!alertsByStep[key]) alertsByStep[key] = [];
    alertsByStep[key].push(a.clientName);
  });

  const summaryAlerts = Object.entries(alertsByStep).slice(0, showAll ? undefined : 3);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">שלבים שטרם הושלמו</h3>
            <Badge className="bg-amber-200 text-amber-800 text-xs">{alerts.length}</Badge>
          </div>
          <div className="space-y-2">
            {summaryAlerts.map(([stepName, clients]) => (
              <div key={stepName} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-amber-900 whitespace-nowrap">{stepName}:</span>
                <span className="text-amber-700">{clients.join(', ')}</span>
              </div>
            ))}
          </div>
          {Object.keys(alertsByStep).length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-amber-700 hover:text-amber-900 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'הצג פחות' : `הצג הכל (${Object.keys(alertsByStep).length})`}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =====================================================
// STEPS VIEW - Main tracking view
// =====================================================

function StepsView({ clientGroups, expandedClients, onToggleExpand, onToggleStep, onDateChange }) {
  return (
    <div className="space-y-3">
      {clientGroups.map(([clientName, clientTasks], index) => (
        <motion.div
          key={clientName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <ClientStepsCard
            clientName={clientName}
            tasks={clientTasks}
            isExpanded={expandedClients[clientName] !== false}
            onToggleExpand={() => onToggleExpand(clientName)}
            onToggleStep={onToggleStep}
            onDateChange={onDateChange}
          />
        </motion.div>
      ))}
    </div>
  );
}

function ClientStepsCard({ clientName, tasks, isExpanded, onToggleExpand, onToggleStep, onDateChange }) {
  // Group tasks by service
  const tasksByService = {};
  tasks.forEach(task => {
    const service = getServiceForTask(task);
    if (service) {
      tasksByService[service.key] = { service, task };
    }
  });

  // Calculate overall completion
  let totalSteps = 0;
  let doneSteps = 0;
  Object.values(tasksByService).forEach(({ service, task }) => {
    const steps = task.process_steps || {};
    totalSteps += service.steps.length;
    doneSteps += service.steps.filter(s => steps[s.key]?.done).length;
  });
  const completionPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const allCompleted = tasks.every(t => t.status === 'completed');

  return (
    <Card className={`border shadow-sm transition-colors ${allCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`}>
      {/* Client header - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800">{clientName}</span>
          <div className="flex items-center gap-1.5">
            {Object.values(tasksByService).map(({ service, task }) => {
              const pct = getStepCompletionPercent(task);
              const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
              return (
                <TooltipProvider key={service.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0.5`}>
                        {service.label} {pct}%
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{service.label}: {statusCfg.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="hidden md:flex items-center gap-2 w-32">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${completionPct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-left">{completionPct}%</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded content - process steps */}
      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-3">
          <div className="border-t border-gray-100 pt-3 space-y-3">
            {Object.values(tasksByService).map(({ service, task }) => (
              <ServiceStepsRow
                key={service.key}
                service={service}
                task={task}
                onToggleStep={onToggleStep}
                onDateChange={onDateChange}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ServiceStepsRow({ service, task, onToggleStep, onDateChange }) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{service.label}</span>
        <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0`}>
          {statusCfg.label}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {service.steps.map(stepDef => {
          const stepData = steps[stepDef.key] || { done: false, date: null };
          return (
            <StepChip
              key={stepDef.key}
              stepDef={stepDef}
              stepData={stepData}
              onToggle={() => onToggleStep(task, stepDef.key)}
              onDateChange={(date) => onDateChange(task, stepDef.key, date)}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepChip({ stepDef, stepData, onToggle, onDateChange }) {
  const [editingDate, setEditingDate] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm transition-all cursor-pointer
        ${stepData.done
          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
          ${stepData.done
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-gray-300 hover:border-emerald-400'
          }
        `}
      >
        {stepData.done && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Label */}
      <span className={`text-xs font-medium ${stepData.done ? 'text-emerald-700' : 'text-gray-600'}`}>
        {stepDef.label}
      </span>

      {/* Date */}
      {stepData.done && stepData.date && (
        <Popover open={editingDate} onOpenChange={setEditingDate}>
          <PopoverTrigger asChild>
            <button className="text-[10px] text-emerald-600 hover:text-emerald-800 bg-emerald-100 rounded px-1 py-0.5">
              {formatDate(stepData.date)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">שנה תאריך:</label>
              <input
                type="date"
                value={stepData.date || ''}
                onChange={(e) => {
                  onDateChange(e.target.value);
                  setEditingDate(false);
                }}
                className="block w-full text-sm border border-gray-300 rounded px-2 py-1"
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// =====================================================
// CLIENT LIST VIEW - Simple status view
// =====================================================

function ClientListView({ clientGroups }) {
  return (
    <div className="space-y-3">
      {clientGroups.map(([clientName, clientTasks]) => (
        <Card key={clientName} className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{clientName}</span>
              <Link to={createPageUrl('ClientsDashboard')}>
                <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-emerald-600 gap-1">
                  <ArrowRight className="w-3 h-3" />
                  לוח
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {clientTasks.map(task => {
                const service = getServiceForTask(task);
                const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
                const pct = getStepCompletionPercent(task);
                return (
                  <li key={task.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700 text-sm">
                      {service?.label || task.title}
                    </span>
                    <div className="flex items-center gap-2">
                      {pct > 0 && pct < 100 && (
                        <span className="text-xs text-gray-400">{pct}%</span>
                      )}
                      <Badge className={`${statusCfg.bg} ${statusCfg.text} text-xs font-semibold`}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
