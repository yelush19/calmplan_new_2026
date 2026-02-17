
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  Loader, RefreshCw, Briefcase, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, Check, Plus, ChevronDown, Trash2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ResizableTable from '@/components/ui/ResizableTable';
import {
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
  markAllStepsDone,
  markAllStepsUndone,
  areAllStepsDone,
} from '@/config/processTemplates';

const payrollDashboardServices = {
  ...PAYROLL_SERVICES,
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'payroll')
  ),
};

const allPayrollCategories = Object.values(payrollDashboardServices).flatMap(s => s.taskCategories);

export default function PayrollDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());

  useEffect(() => { loadData(); }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const [tasksData, clientsData] = await Promise.all([
        Task.filter({
          context: 'work',
          due_date: { '>=': format(start, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }),
        Client.list(null, 500).catch(() => []),
      ]);
      const filtered = (tasksData || []).filter(t => allPayrollCategories.includes(t.category));
      setTasks(filtered);
      setClients(clientsData || []);
      syncCompletedTaskSteps(filtered);
    } catch (error) {
      console.error("Error loading payroll tasks:", error);
    }
    setIsLoading(false);
  };

  const syncCompletedTaskSteps = async (tasksList) => {
    for (const task of tasksList) {
      if (task.status === 'completed' && !areAllStepsDone(task)) {
        const updatedSteps = markAllStepsDone(task);
        if (Object.keys(updatedSteps).length > 0) {
          await Task.update(task.id, { process_steps: updatedSteps });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
        }
      }
    }
  };

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

  const serviceData = useMemo(() => {
    const result = {};
    Object.values(payrollDashboardServices).forEach(service => {
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
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };
      if (allDone && task.status !== 'completed') {
        updatePayload.status = 'completed';
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
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

  const handleStatusChange = useCallback(async (task, newStatus) => {
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === 'completed') {
        updatePayload.process_steps = markAllStepsDone(task);
      } else if (task.status === 'completed' && newStatus === 'not_started') {
        updatePayload.process_steps = markAllStepsUndone(task);
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
    } catch (error) { console.error("Error updating status:", error); }
  }, []);

  const handlePaymentDateChange = useCallback(async (task, paymentDate) => {
    try {
      await Task.update(task.id, { payment_due_date: paymentDate });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, payment_due_date: paymentDate } : t));
    } catch (error) { console.error("Error updating payment date:", error); }
  }, []);

  const handleSubTaskChange = useCallback(async (task, subTasks) => {
    try {
      await Task.update(task.id, { sub_tasks: subTasks });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, sub_tasks: subTasks } : t));
    } catch (error) { console.error("Error updating sub-tasks:", error); }
  }, []);

  const handleMonthChange = (dir) => {
    setSelectedMonth(c => dir === 'prev' ? subMonths(c, 1) : addMonths(c, 1));
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-gray-600 text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-white/20 rounded-full p-0.5 ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-md">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">שכר ודיווחי רשויות</h1>
            <p className="text-gray-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | שכר, ניכויים, ביטוח לאומי, מס"ב ועוד</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">סה"כ תהליכים</div>
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
            <div className="text-xs text-gray-500">תהליכים שהושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-sky-700">{stats.stepsPct}%</div>
            <div className="text-xs text-gray-500">שלבים ({stats.doneSteps}/{stats.totalSteps})</div>
          </CardContent>
        </Card>
      </div>

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
              onStatusChange={handleStatusChange}
              onPaymentDateChange={handlePaymentDateChange}
              onSubTaskChange={handleSubTaskChange}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-gray-200">
          <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">לא נמצאו תהליכי שכר לחודש הנבחר</h3>
          <p className="text-gray-500">נסה לבחור חודש אחר או ליצור משימות חוזרות</p>
        </Card>
      )}
    </div>
  );
}

function ServiceTable({ service, clientRows, onToggleStep, onDateChange, onStatusChange, onPaymentDateChange, onSubTaskChange }) {
  const completedCount = clientRows.filter(r => r.task.status === 'completed').length;

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
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

      <div className="overflow-x-auto">
        <ResizableTable className="w-full text-sm">
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
                onStatusChange={onStatusChange}
                onPaymentDateChange={onPaymentDateChange}
                onSubTaskChange={onSubTaskChange}
              />
            ))}
          </tbody>
        </ResizableTable>
      </div>
    </Card>
  );
}

// Get relevant tax IDs for payroll services
function getPayrollIds(client, serviceKey) {
  if (!client) return [];
  const ids = [];
  const ti = client.tax_info || {};
  const annual = ti.annual_tax_ids || {};

  switch (serviceKey) {
    case 'deductions':
      if (ti.tax_deduction_file_number) ids.push({ label: 'פנקס', value: ti.tax_deduction_file_number });
      if (annual.deductions_id) ids.push({ label: 'ניכויים', value: annual.deductions_id });
      break;
    case 'social_security':
      if (ti.social_security_file_number) ids.push({ label: 'תיק ביט"ל', value: ti.social_security_file_number });
      break;
    default:
      if (client.entity_number) ids.push({ label: 'ח"פ', value: client.entity_number });
  }
  return ids;
}

function ClientRow({ clientName, task, client, service, isEven, onToggleStep, onDateChange, onStatusChange, onPaymentDateChange, onSubTaskChange }) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const allDone = service.steps.every(s => steps[s.key]?.done);
  const taxIds = getPayrollIds(client, service.key);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDue, setNewSubDue] = useState('');

  const statusOptions = ['not_started', 'in_progress', 'waiting_for_materials', 'waiting_for_approval', 'ready_for_reporting', 'reported_waiting_for_payment', 'completed', 'not_relevant'];

  const subTasks = task.sub_tasks || [];

  const handleAddSubTask = () => {
    if (!newSubTitle.trim()) return;
    const updated = [...subTasks, { id: `st_${Date.now()}`, title: newSubTitle.trim(), due_date: newSubDue || null, done: false }];
    onSubTaskChange(task, updated);
    setNewSubTitle('');
    setNewSubDue('');
  };

  const handleToggleSubTask = (subId) => {
    const updated = subTasks.map(st => st.id === subId ? { ...st, done: !st.done } : st);
    onSubTaskChange(task, updated);
    if (updated.every(st => st.done) && updated.length > 0 && task.status !== 'completed') {
      onStatusChange(task, 'ready_for_reporting');
    }
  };

  const handleDeleteSubTask = (subId) => {
    onSubTaskChange(task, subTasks.filter(st => st.id !== subId));
  };

  return (
    <>
      <tr className={`border-b border-gray-50 transition-colors ${allDone ? 'bg-emerald-50/40' : isEven ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-100/50`}>
        <td className={`py-1.5 px-4 sticky right-0 z-10 ${allDone ? 'bg-emerald-50/40' : isEven ? 'bg-white' : 'bg-gray-50/30'}`}>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSubTasks(!showSubTasks)} className="text-gray-400 hover:text-gray-600 shrink-0" title="תת משימות">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSubTasks ? 'rotate-180' : ''}`} />
            </button>
            <div className="min-w-0">
              <span className="truncate block max-w-[180px] font-medium text-gray-800 text-xs">{clientName}</span>
              {taxIds.length > 0 && (
                <div className="flex gap-2 mt-0.5">
                  {taxIds.map(({ label, value }) => (
                    <span key={label} className="text-[10px] text-gray-400">
                      <span className="font-medium">{label}:</span> {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {subTasks.length > 0 && (
              <Badge className="text-[9px] px-1 py-0 bg-indigo-100 text-indigo-600 shrink-0">
                {subTasks.filter(s => s.done).length}/{subTasks.length}
              </Badge>
            )}
          </div>
        </td>

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

        <td className="py-1.5 px-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <Popover open={showStatusMenu} onOpenChange={setShowStatusMenu}>
              <PopoverTrigger asChild>
                <button className="cursor-pointer">
                  <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0.5 font-semibold hover:opacity-80 transition-opacity`}>
                    {statusCfg.label}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="center" side="top">
                <div className="space-y-0.5">
                  {statusOptions.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    if (!cfg) return null;
                    return (
                      <button
                        key={s}
                        onClick={() => { onStatusChange(task, s); setShowStatusMenu(false); }}
                        className={`w-full text-right px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-gray-100 flex items-center gap-2 ${task.status === s ? 'bg-gray-100 font-bold' : ''}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg} border ${cfg.border}`} />
                        {cfg.label}
                        {s === 'completed' && <span className="text-[9px] text-gray-400 mr-auto">(+כל השלבים)</span>}
                      </button>
                    );
                  })}
                </div>
                {task.status === 'reported_waiting_for_payment' && (
                  <div className="border-t mt-1 pt-2 px-2 pb-1">
                    <label className="text-[10px] text-gray-500 block mb-1">תאריך יעד לתשלום:</label>
                    <input type="date" value={task.payment_due_date || ''} onChange={(e) => onPaymentDateChange(task, e.target.value)} className="w-full text-xs border border-yellow-300 rounded px-2 py-1 bg-yellow-50" />
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {task.status === 'reported_waiting_for_payment' && task.payment_due_date && (
              <span className="text-[9px] text-yellow-700 font-medium">
                תשלום: {new Date(task.payment_due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </td>
      </tr>
      {showSubTasks && (
        <tr className="bg-indigo-50/30">
          <td colSpan={service.steps.length + 2} className="px-4 py-2">
            <div className="space-y-1.5 mr-6">
              {subTasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 text-xs">
                  <button onClick={() => handleToggleSubTask(st.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${st.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}>
                    {st.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{st.title}</span>
                  {st.due_date && <span className="text-[10px] text-gray-400">{new Date(st.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>}
                  <button onClick={() => handleDeleteSubTask(st.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <input value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)} placeholder="תת משימה חדשה..." className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white" onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()} />
                <input type="date" value={newSubDue} onChange={(e) => setNewSubDue(e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-1 w-[100px] bg-white" />
                <button onClick={handleAddSubTask} disabled={!newSubTitle.trim()} className="text-indigo-500 hover:text-indigo-700 disabled:text-gray-300"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StepCell({ stepData, onToggle, onDateChange }) {
  const [editingDate, setEditingDate] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (!stepData.done) {
    return (
      <button
        onClick={onToggle}
        className="w-8 h-8 mx-auto rounded-md border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center group"
      >
        <Check className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
      </button>
    );
  }

  return (
    <Popover open={editingDate} onOpenChange={setEditingDate}>
      <PopoverTrigger asChild>
        <button className="w-full mx-auto flex flex-col items-center gap-0 group">
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
