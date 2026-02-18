import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ResizableTable from '@/components/ui/ResizableTable';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  STATUS_CONFIG,
  getTaskProcessSteps,
} from '@/config/processTemplates';

// Status display order by priority (lower = more urgent = shown first)
const STATUS_DISPLAY_ORDER = [
  'issue',                        // 0 - דורש טיפול
  'waiting_for_materials',        // 1 - ממתין לחומרים
  'in_progress',                  // 2 - בעבודה
  'waiting_for_approval',         // 2 - לבדיקה
  'not_started',                  // 3 - נותרו השלמות
  'ready_for_reporting',          // 3 - מוכן לדיווח
  'postponed',                    // 4 - נדחה
  'reported_waiting_for_payment', // 4 - ממתין לתשלום
  'completed',                    // 5 - הושלם
  'not_relevant',                 // 6 - לא רלוונטי
];

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

  const colCount = service.steps.length + 2; // client + steps + status

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* Service header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-800">{service.label}</h2>
          <span className="text-xs text-gray-500">{completedCount}/{relevantRows.length} הושלמו</span>
        </div>
        <div className="w-24 bg-gray-200 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${relevantRows.length > 0 ? Math.round((completedCount / relevantRows.length) * 100) : 0}%` }}
          />
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

function ClientRow({ clientName, task, client, service, isEven, onToggleStep, onDateChange, onStatusChange, onPaymentDateChange, onSubTaskChange, onAttachmentUpdate, getClientIds }) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const allDone = service.steps.every(s => steps[s.key]?.done);
  const taxIds = getClientIds ? getClientIds(client, service.key) : [];
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
              {subTasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleToggleSubTask(st.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${st.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-400'}`}
                  >
                    {st.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{st.title}</span>
                  {st.due_date && <span className="text-[10px] text-gray-400">{new Date(st.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>}
                  <button onClick={() => handleDeleteSubTask(st.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
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
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 w-[100px] bg-white"
                />
                <button onClick={handleAddSubTask} disabled={!newSubTitle.trim()} className="text-indigo-500 hover:text-indigo-700 disabled:text-gray-300">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 pt-2 border-t border-indigo-100">
                <TaskFileAttachments
                  taskId={task.id}
                  attachments={task.attachments || []}
                  onUpdate={(updated) => onAttachmentUpdate(task, updated)}
                  clientId={task.client_id}
                  clientName={task.client_name}
                />
              </div>
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
