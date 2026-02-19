import React, { useState, useMemo } from 'react';
const fixShortYear = (v) => { if (!v) return v; const m = v.match(/^(\d{1,2})-(\d{2})-(\d{2})$/); if (m) { const yr = parseInt(m[1], 10); return `${yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr}-${m[2]}-${m[3]}`; } return v; };
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronLeft, Plus, Trash2, Pencil, Pin, FileText, Timer, Calendar, Zap, FastForward } from 'lucide-react';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ResizableTable from '@/components/ui/ResizableTable';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  STATUS_CONFIG,
  getTaskProcessSteps,
} from '@/config/processTemplates';
import { getVatEnergyTier, getPayrollTier } from '@/engines/taskCascadeEngine';

// Status display order by priority (lower = more urgent = shown first)
const STATUS_DISPLAY_ORDER = [
  'issue',                        // 0 - דורש טיפול
  'waiting_for_materials',        // 1 - ממתין לחומרים
  'in_progress',                  // 2 - בעבודה
  'remaining_completions',        // 2 - נותרו השלמות
  'waiting_for_approval',         // 2 - לבדיקה
  'not_started',                  // 3 - טרם התחיל
  'ready_for_reporting',          // 3 - מוכן לדיווח
  'postponed',                    // 4 - נדחה
  'reported_waiting_for_payment', // 4 - ממתין לתשלום
  'pending_external',             // 3 - מחכה לצד ג'
  'completed',                    // 5 - הושלם
  'not_relevant',                 // 6 - לא רלוונטי
];

function ExecutionBar({ startDate, dueDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = dueDate ? parseISO(dueDate) : null;
  const start = startDate ? parseISO(startDate) : null;
  const remaining = end && isValid(end) ? differenceInDays(end, today) : null;

  if (remaining === null) return null;

  let totalDays = 0;
  let progress = 0;
  if (start && isValid(start) && end) {
    totalDays = differenceInDays(end, start);
    const elapsed = differenceInDays(today, start);
    progress = totalDays > 0 ? Math.min(Math.max((elapsed / totalDays) * 100, 0), 100) : 0;
  }

  const isOverdue = remaining < 0;
  const barColor = isOverdue ? 'bg-amber-500' : remaining <= 1 ? 'bg-amber-400' : remaining <= 3 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = isOverdue ? 'text-amber-600' : remaining <= 1 ? 'text-amber-500' : remaining <= 3 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-2 space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1 text-gray-500">
          <Timer className="w-3 h-3" />
          {start && isValid(start) ? format(start, 'd/M') : '—'}
          {' → '}
          {end && isValid(end) ? format(end, 'd/M') : '—'}
          {totalDays > 0 && <span className="text-gray-400">({totalDays}d)</span>}
        </span>
        <span className={`font-bold ${textColor}`}>
          {isOverdue
            ? `באיחור ${Math.abs(remaining)}d`
            : remaining === 0
              ? 'היום!'
              : `נותרו ${remaining}d`}
        </span>
      </div>
      {totalDays > 0 && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// These statuses start collapsed
const DEFAULT_COLLAPSED = new Set(['completed', 'not_relevant']);

export default function GroupedServiceTable({
  service,
  clientRows,
  onToggleStep,
  onDateChange,
  onStatusChange,
  onPaymentDateChange,
  onSubTaskChange,
  onAttachmentUpdate,
  getClientIds,
  onEdit,
  onDelete,
  onNote,
}) {
  const relevantRows = clientRows.filter(r => r.task.status !== 'not_relevant');
  const completedCount = relevantRows.filter(r => r.task.status === 'completed').length;

  // Group rows by status
  const statusGroups = useMemo(() => {
    const groups = {};
    clientRows.forEach(row => {
      const status = row.task.status || 'not_started';
      if (!groups[status]) groups[status] = [];
      groups[status].push(row);
    });

    // Sort each group by client name
    Object.values(groups).forEach(group => {
      group.sort((a, b) => a.clientName.localeCompare(b.clientName, 'he'));
    });

    // Return sorted by display order
    return STATUS_DISPLAY_ORDER
      .filter(s => groups[s] && groups[s].length > 0)
      .map(status => ({
        status,
        config: STATUS_CONFIG[status] || STATUS_CONFIG.not_started,
        rows: groups[status],
      }));
  }, [clientRows]);

  // Track collapsed state per status
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const initial = {};
    STATUS_DISPLAY_ORDER.forEach(s => {
      if (DEFAULT_COLLAPSED.has(s)) initial[s] = true;
    });
    return initial;
  });

  const toggleGroup = (status) => {
    setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };
  const expandAll = () => setCollapsedGroups({});
  const collapseAll = () => {
    const all = {};
    STATUS_DISPLAY_ORDER.forEach(s => { all[s] = true; });
    setCollapsedGroups(all);
  };

  const colCount = service.steps.length + 2; // client + steps + status

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* Service header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-800">{service.label}</h2>
          <span className="text-xs text-gray-500">{completedCount}/{relevantRows.length} הושלמו</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-lg p-0.5 shadow-sm border text-xs">
            <button onClick={expandAll} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors">
              פתח הכל
            </button>
            <button onClick={collapseAll} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors">
              סגור הכל
            </button>
          </div>
          <div className="w-24 bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${relevantRows.length > 0 ? Math.round((completedCount / relevantRows.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <ResizableTable className="w-full text-sm" stickyHeader maxHeight="70vh">
          <thead>
            <tr className="border-b border-gray-100 bg-white">
              <th className="text-right py-2 px-4 font-semibold text-gray-600 text-xs bg-gray-50 sticky right-0 z-30 min-w-[140px]">
                לקוח
              </th>
              {service.steps.map(step => (
                <th key={step.key} className="text-center py-2 px-2 font-medium text-gray-500 text-[11px] bg-gray-50 min-w-[80px]">
                  {step.label}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium text-gray-500 text-[11px] bg-gray-50 min-w-[80px]">
                סטטוס
              </th>
            </tr>
          </thead>
          <tbody>
            {statusGroups.map(({ status, config, rows }) => {
              const isCollapsed = !!collapsedGroups[status];
              return (
                <React.Fragment key={status}>
                  {/* Status group header */}
                  <tr
                    className="cursor-pointer select-none hover:bg-gray-50/80 transition-colors"
                    onClick={() => toggleGroup(status)}
                  >
                    <td
                      colSpan={colCount}
                      className="py-1.5 px-4 border-b border-gray-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isCollapsed ? 'rotate-[-90deg]' : ''}`}
                        />
                        <div className={`w-2.5 h-2.5 rounded-full ${config.bg} border ${config.border} shrink-0`} />
                        <span className="font-semibold text-gray-700 text-xs">{config.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 font-normal">
                          {rows.length}
                        </Badge>
                        {/* Mini progress for this group */}
                        <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-1 mr-auto">
                          <div
                            className={`h-1 rounded-full transition-all ${status === 'completed' ? 'bg-emerald-500' : status === 'not_relevant' ? 'bg-gray-300' : 'bg-sky-400'}`}
                            style={{ width: `${rows.length > 0 ? Math.round((rows.filter(r => r.task.status === 'completed').length / rows.length) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {/* Client rows */}
                  {!isCollapsed && rows.map(({ clientName, task, client }, idx) => (
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
                      onAttachmentUpdate={onAttachmentUpdate}
                      getClientIds={getClientIds}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onNote={onNote}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </ResizableTable>
      </div>
    </Card>
  );
}

// =====================================================
// CLIENT ROW
// =====================================================

function ClientRow({ clientName, task, client, service, isEven, onToggleStep, onDateChange, onStatusChange, onPaymentDateChange, onSubTaskChange, onAttachmentUpdate, getClientIds, onEdit, onDelete, onNote }) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const allDone = service.steps.every(s => steps[s.key]?.done);
  const taxIds = getClientIds ? getClientIds(client, service.key) : [];
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDue, setNewSubDue] = useState('');
  const [newSubTime, setNewSubTime] = useState('');

  // Energy tier computation
  const isVat = service.key === 'vat' || service.key === 'tax_advances';
  const isPayroll = service.key === 'payroll';
  const vatTier = isVat ? getVatEnergyTier(task) : null;
  const payrollTier = isPayroll && client ? getPayrollTier(client) : null;
  const isQuickWin = vatTier?.key === 'quick_win' || payrollTier?.key === 'nano';
  const isClimb = vatTier?.key === 'climb';

  const statusOptions = ['not_started', 'in_progress', 'waiting_for_materials', 'waiting_for_approval', 'ready_for_reporting', 'reported_waiting_for_payment', 'pending_external', 'completed', 'not_relevant'];

  const subTasks = task.sub_tasks || [];

  const handleAddSubTask = () => {
    if (!newSubTitle.trim()) return;
    const updated = [...subTasks, { id: `st_${Date.now()}`, title: newSubTitle.trim(), due_date: newSubDue || null, due_time: newSubTime || null, done: false }];
    onSubTaskChange(task, updated);
    setNewSubTitle('');
    setNewSubDue('');
    setNewSubTime('');
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
        {/* Client name + IDs */}
        <td className={`py-1.5 px-4 sticky right-0 z-10 ${allDone ? 'bg-emerald-50/40' : isEven ? 'bg-white' : 'bg-gray-50/30'}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSubTasks(!showSubTasks)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              title="תת משימות"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSubTasks ? 'rotate-180' : ''}`} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate block max-w-[160px] font-medium text-gray-800 text-xs">{clientName}</span>
                {isQuickWin && task.status !== 'completed' && (
                  <span className="text-emerald-500 shrink-0" title="Quick Win">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                )}
                {isClimb && task.status !== 'completed' && (
                  <Badge className="text-[8px] px-1 py-0 bg-purple-100 text-purple-600 border-purple-200 shrink-0">45+</Badge>
                )}
              </div>
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
            {(() => {
              if (!task.due_date) return null;
              const d = parseISO(task.due_date);
              if (!isValid(d)) return null;
              const t = new Date(); t.setHours(0,0,0,0);
              const rem = differenceInDays(d, t);
              if (rem < 0) return <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 shrink-0">-{Math.abs(rem)}d</Badge>;
              if (rem <= 3) return <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 shrink-0">{rem}d</Badge>;
              return null;
            })()}
          </div>
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

        {/* Status + payment date */}
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
                    <input
                      type="date"
                      value={task.payment_due_date || ''}
                      onChange={(e) => onPaymentDateChange(task, e.target.value)}
                      className="w-full text-xs border border-yellow-300 rounded px-2 py-1 bg-yellow-50"
                    />
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
      {/* Sub-tasks row */}
      {showSubTasks && (
        <tr className="bg-indigo-50/30">
          <td colSpan={service.steps.length + 2} className="px-4 py-2">
            <div className="space-y-1.5 mr-6">
              {/* Fast-Track button for nano payroll */}
              {payrollTier?.fastTrack && task.status !== 'completed' && (
                <button
                  onClick={() => onStatusChange(task, 'completed')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  <FastForward className="w-4 h-4" />
                  Fast-Track - סיום מהיר (Nano {payrollTier.emoji})
                </button>
              )}
              {/* Climb task progress bar */}
              {isClimb && task.status !== 'completed' && (
                <div className="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                  <div className="flex items-center justify-between text-xs text-purple-700 font-medium mb-1">
                    <span>משימת עומק - {task.estimated_duration || 45}+ דקות</span>
                    {task.sub_tasks?.length > 0 && (
                      <span>שלב {task.sub_tasks.filter(s => s.done).length + 1} מתוך {task.sub_tasks.length}</span>
                    )}
                  </div>
                  {task.sub_tasks?.length > 0 && (
                    <div className="w-full h-2 bg-purple-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${(task.sub_tasks.filter(s => s.done).length / task.sub_tasks.length) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              {subTasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleToggleSubTask(st.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${st.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}
                  >
                    {st.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{st.title}</span>
                  {st.due_time && <span className="text-[10px] text-blue-400">{st.due_time}</span>}
                  {st.due_date && <span className="text-[10px] text-gray-400">{new Date(st.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>}
                  <button onClick={() => handleDeleteSubTask(st.id)} className="text-gray-300 hover:text-amber-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                  placeholder="תת משימה חדשה..."
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
                />
                <input
                  type="date"
                  value={newSubDue}
                  onChange={(e) => setNewSubDue(e.target.value)}
                  onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setNewSubDue(f); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 w-[100px] bg-white"
                />
                <input
                  type="time"
                  value={newSubTime}
                  onChange={(e) => setNewSubTime(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 w-[80px] bg-white"
                />
                <button onClick={handleAddSubTask} disabled={!newSubTitle.trim()} className="text-indigo-500 hover:text-indigo-700 disabled:text-gray-300">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {/* Tax/Reporting Info Card */}
              {taxIds.length > 0 && (
                <div className="mt-3 pt-2 border-t border-indigo-100">
                  <div className="bg-blue-50 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1 text-xs font-medium text-blue-700">
                      <FileText className="w-3 h-3" />
                      פרטי דיווח
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {taxIds.map(({ label, value }) => (
                        <div key={label} className="text-[11px]">
                          <span className="text-blue-500">{label}:</span>{' '}
                          <span className="font-mono font-medium text-blue-900 select-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Execution Period Timeline */}
              {(task.scheduled_start || task.due_date) && (
                <div className="mt-2">
                  <ExecutionBar startDate={task.scheduled_start} dueDate={task.due_date} />
                </div>
              )}
              <div className="mt-3 pt-2 border-t border-indigo-100">
                <TaskFileAttachments
                  taskId={task.id}
                  attachments={task.attachments || []}
                  onUpdate={(updated) => onAttachmentUpdate(task, updated)}
                  clientId={task.client_id}
                  clientName={task.client_name}
                />
              </div>
              {/* Edit / Delete actions */}
              {(onEdit || onDelete || onNote) && (
                <div className="mt-3 pt-2 border-t border-indigo-100 flex items-center gap-2">
                  {onNote && (
                    <button
                      onClick={() => onNote(task)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded px-2 py-1 transition-colors"
                    >
                      <Pin className="w-3 h-3" />
                      הוסף לפתק
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(task)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      עריכת משימה
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(task)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded px-2 py-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      מחק
                    </button>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// =====================================================
// STEP CELL
// =====================================================

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
            className="w-full text-xs text-amber-500 hover:text-amber-700 hover:border-amber-300"
            onClick={() => { onToggle(); setEditingDate(false); }}
          >
            בטל סימון
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
