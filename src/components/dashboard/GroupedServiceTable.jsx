import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Task } from '@/api/entities';
const fixShortYear = (v) => { if (!v) return v; const m = v.match(/^(\d{1,2})-(\d{2})-(\d{2})$/); if (m) { const yr = parseInt(m[1], 10); return `${yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr}-${m[2]}-${m[3]}`; } return v; };
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronLeft, Plus, Trash2, Pencil, Pin, FileText, Timer, Calendar, Zap, FastForward, Paperclip, GripVertical, StickyNote, Brain, Copy, Shield, ShieldCheck, Lock } from 'lucide-react';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ResizableTable from '@/components/ui/ResizableTable';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  STATUS_CONFIG,
  getTaskProcessSteps,
} from '@/config/processTemplates';
import { getVatEnergyTier, getPayrollTier, getBlockedByReasons } from '@/engines/taskCascadeEngine';

const SERVICE_ACCENT_COLORS = {
  'vat': { border: '#3B82F6', bg: '#F8FAFF', headerBg: '#EBF0FF', headerText: '#1E3A5F' },
  'vat_874': { border: '#1D4ED8', bg: '#F8FAFF', headerBg: '#E0E7FF', headerText: '#1E3A5F' },
  'tax_advances': { border: '#F97316', bg: '#FFFBF5', headerBg: '#FFF0DB', headerText: '#7C2D12' },
  'income_collection': { border: '#22C55E', bg: '#F8FFF8', headerBg: '#E6F9E6', headerText: '#14532D' },
  'expense_collection': { border: '#8B5CF6', bg: '#FAFAFF', headerBg: '#EDE9FE', headerText: '#3B0764' },
  'reconciliation': { border: '#F59E0B', bg: '#FFFDF5', headerBg: '#FFF3D0', headerText: '#78350F' },
  'pnl_reports': { border: '#8B5CF6', bg: '#FBFAFF', headerBg: '#EDE9FE', headerText: '#3B0764' },
  'payroll': { border: '#06B6D4', bg: '#F8FFFE', headerBg: '#E0F7FA', headerText: '#164E63' },
  'social_security': { border: '#0891B2', bg: '#F0FDFA', headerBg: '#CFFAFE', headerText: '#164E63' },
  'deductions': { border: '#EAB308', bg: '#FFFEF5', headerBg: '#FEF3C7', headerText: '#713F12' },
};

function getServiceAccent(serviceKey) {
  return SERVICE_ACCENT_COLORS[serviceKey] || { border: '#94A3B8', bg: '#F8FAFC', headerBg: '#E2E8F0' };
}

const COGNITIVE_LOAD_CONFIG = {
  1: { label: 'קל', color: '#22C55E', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  2: { label: 'בינוני', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700' },
  3: { label: 'כבד', color: '#D97706', bg: 'bg-amber-50', text: 'text-amber-800' },
};

// Statuses — display order by workflow progression
const STATUS_DISPLAY_ORDER = [
  'waiting_for_materials',       // 1 - ממתין לחומרים
  'not_started',                 // 2 - לבצע
  'ready_to_broadcast',          // 3 - מוכן לשידור
  'reported_pending_payment',    // 4 - שודר, ממתין לתשלום
  'awaiting_recording',          // 4.5 - ממתין לרישום בהנה"ש
  'sent_for_review',             // 3 - הועבר לעיון (payroll)
  'review_after_corrections',    // 3.2 - הועבר לעיון לאחר תיקונים
  'needs_corrections',           // 3 - לבצע תיקונים
  'production_completed',        // 5 - הושלם ייצור
];

/**
 * Status label — uses the config label directly.
 * (Previously overrode sent_for_review for authority tasks,
 *  now they use ready_to_broadcast / reported_pending_payment.)
 */
function getStatusLabel(statusKey, config, serviceTaskType) {
  return config.label;
}

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
      <div className="flex items-center justify-between text-[12px]">
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

// ALL statuses start collapsed by default
// All status groups start OPEN — client requested no collapsing
const DEFAULT_COLLAPSED = new Set();

// Inline notes editor — saves directly to DB
function NotesCell({ taskId, initialNotes }) {
  const [val, setVal] = useState(initialNotes || '');
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef(null);

  const saveNow = useCallback(async (text) => {
    try {
      await Task.update(taskId, { notes: text });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  }, [taskId]);

  const handleChange = useCallback((e) => {
    const text = e.target.value;
    setVal(text);
    setSaved(false);
    // Debounce: save 1 second after last keystroke
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(text), 1000);
  }, [saveNow]);

  // Save immediately on blur
  const handleBlur = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!saved) saveNow(val);
  }, [val, saved, saveNow]);

  // Cleanup
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  return (
    <textarea
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="הערות..."
      className={`w-full text-xs border rounded px-2 py-1 resize-none h-8 focus:h-16 transition-all bg-white ${!saved ? 'border-amber-300' : 'border-gray-200 focus:border-blue-300'}`}
      rows={1}
    />
  );
}

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
  bulkMode = false,
  selectedTaskIds = new Set(),
  onToggleSelect,
  onReorder,
  allTasks = [],
  reserveTasks = [],
  onReserveToggle,
}) {
  const relevantRows = clientRows;
  const completedCount = relevantRows.filter(r => r.task.status === 'production_completed').length;

  // Group rows by status
  const statusGroups = useMemo(() => {
    const groups = {};
    clientRows.forEach(row => {
      const status = row.task.status || 'not_started';
      if (!groups[status]) groups[status] = [];
      groups[status].push(row);
    });

    // Sort each group: manual sort_order first, then alphabetically
    Object.values(groups).forEach(group => {
      group.sort((a, b) => {
        const oa = a.task.sort_order ?? Infinity;
        const ob = b.task.sort_order ?? Infinity;
        if (oa !== ob) return oa - ob;
        return a.clientName.localeCompare(b.clientName, 'he');
      });
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

  // Drag-to-reorder within a status group
  const handleDragEnd = useCallback((result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const group = statusGroups.find(g => g.status === source.droppableId);
    if (!group) return;

    const items = [...group.rows];
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);

    // Persist sort_order for each reordered task
    items.forEach((row, idx) => {
      const newOrder = idx + 1;
      if (row.task.sort_order !== newOrder) {
        onReorder?.(row.task, newOrder);
      }
    });
  }, [statusGroups, onReorder]);

  const colCount = service.steps.length + 2; // client + steps + status

  const accent = getServiceAccent(service.key);

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* Service header */}
      <div
        className="border-b px-4 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: accent.headerBg, borderLeftWidth: '4px', borderLeftColor: accent.border, borderBottomColor: accent.border + '40' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="font-extrabold text-base" style={{ color: accent.headerText || '#1F2937' }}>{service.label}</h2>
          <span className="text-xs font-bold" style={{ color: accent.headerText || '#374151' }}>{completedCount}/{relevantRows.length} הושלמו</span>
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
              {bulkMode && (
                <th className="text-center py-2 px-2 bg-gray-50 w-8">
                  <input type="checkbox"
                    checked={clientRows.every(r => selectedTaskIds.has(r.task.id))}
                    onChange={() => {
                      const allSelected = clientRows.every(r => selectedTaskIds.has(r.task.id));
                      const ids = clientRows.map(r => r.task.id);
                      if (onToggleSelect) onToggleSelect(ids, !allSelected);
                    }}
                    className="w-4 h-4 rounded border-violet-300 text-violet-600 accent-violet-600" />
                </th>
              )}
              <th className="text-right py-2.5 px-4 font-bold text-gray-800 text-[13px] bg-gray-50 sticky right-0 z-30 min-w-[140px]">
                לקוח
              </th>
              {service.steps.map(step => {
                const stepDoneCount = clientRows.filter(r => {
                  const s = getTaskProcessSteps(r.task);
                  return s[step.key]?.done;
                }).length;
                const stepAllDone = stepDoneCount === clientRows.length && clientRows.length > 0;
                const stepSomeDone = stepDoneCount > 0;
                return (
                  <th
                    key={step.key}
                    className="text-center py-2.5 px-2 font-bold text-[12px] min-w-[80px]"
                    style={{
                      backgroundColor: stepAllDone ? '#E5E7EB' : stepSomeDone ? accent.headerBg : '#F9FAFB',
                      color: stepAllDone ? '#374151' : stepSomeDone ? (accent.headerText || '#1F2937') : '#374151',
                      borderBottom: `2px solid ${stepAllDone ? '#9CA3AF' : stepSomeDone ? accent.border : '#E5E7EB'}`,
                    }}
                  >
                    {step.label}
                    <div className="text-[10px] font-semibold mt-0.5" style={{ color: stepAllDone ? '#166534' : '#6B7280' }}>
                      {stepDoneCount}/{clientRows.length}
                    </div>
                  </th>
                );
              })}
              <th className="text-center py-2.5 px-3 font-bold text-gray-800 text-[13px] bg-gray-50 min-w-[80px]">
                מהות משימה
              </th>
              <th className="text-right py-2.5 px-3 font-bold text-gray-800 text-[13px] bg-gray-50 min-w-[120px]">
                הערות
              </th>
            </tr>
          </thead>
          <DragDropContext onDragEnd={handleDragEnd}>
            <tbody>
              {statusGroups.map(({ status, config, rows }) => {
                const isCollapsed = !!collapsedGroups[status];
                return (
                  <React.Fragment key={status}>
                    {/* Status group header */}
                    <tr
                      className="cursor-pointer select-none hover:bg-[#F5F5F5] transition-colors"
                      onClick={() => toggleGroup(status)}
                    >
                      <td
                        colSpan={colCount + 1}
                        className="py-1.5 px-4 border-b border-gray-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isCollapsed ? 'rotate-[-90deg]' : ''}`}
                          />
                          <div className={`w-2.5 h-2.5 rounded-full ${config.bg} border ${config.border} shrink-0`} />
                          <span className="font-bold text-gray-900 text-sm">{getStatusLabel(status, config, service.taskType)}</span>
                          <Badge variant="secondary" className="text-[12px] px-1.5 py-0 bg-gray-100 text-gray-700 font-semibold">
                            {rows.length}
                          </Badge>
                          {/* Mini progress for this group */}
                          <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-1 mr-auto">
                            <div
                              className={`h-1 rounded-full transition-all ${status === 'production_completed' ? 'bg-emerald-500' : 'bg-sky-400'}`}
                              style={{ width: `${rows.length > 0 ? Math.round((rows.filter(r => r.task.status === 'production_completed').length / rows.length) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                    {/* Droppable client rows */}
                    {!isCollapsed && (
                      <Droppable droppableId={status}>
                        {(provided) => (
                          <tr ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'contents' }}>
                            {rows.map(({ clientName, task, client }, idx) => (
                              <Draggable key={task.id} draggableId={task.id} index={idx}>
                                {(dragProvided, snapshot) => (
                                  <ClientRow
                                    ref={dragProvided.innerRef}
                                    dragHandleProps={dragProvided.dragHandleProps}
                                    draggableProps={dragProvided.draggableProps}
                                    isDragging={snapshot.isDragging}
                                    clientName={clientName}
                                    task={task}
                                    client={client}
                                    service={service}
                                    accent={accent}
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
                                    bulkMode={bulkMode}
                                    isSelected={selectedTaskIds.has(task.id)}
                                    onToggleSelect={onToggleSelect}
                                    allTasks={allTasks}
                                    reserveTasks={reserveTasks}
                                    onReserveToggle={onReserveToggle}
                                  />
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </tr>
                        )}
                      </Droppable>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </DragDropContext>
        </ResizableTable>
      </div>
    </Card>
  );
}

// =====================================================
// CLIENT ROW
// =====================================================

const ClientRow = React.forwardRef(function ClientRow({ clientName, task, client, service, accent, isEven, onToggleStep, onDateChange, onStatusChange, onPaymentDateChange, onSubTaskChange, onAttachmentUpdate, getClientIds, onEdit, onDelete, onNote, bulkMode, isSelected, onToggleSelect, dragHandleProps, draggableProps, isDragging, allTasks = [], reserveTasks = [], onReserveToggle }, ref) {
  const steps = getTaskProcessSteps(task);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const allDone = service.steps.every(s => steps[s.key]?.done);

  // ── Visual hierarchy: overdue/urgent detection for row background ──
  const rowUrgency = useMemo(() => {
    if (allDone || task.status === 'production_completed') return 'done';
    if (!task.due_date) return 'normal';
    const d = parseISO(task.due_date);
    if (!isValid(d)) return 'normal';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const rem = differenceInDays(d, t);
    if (rem < 0) return 'overdue';
    if (rem <= 3) return 'urgent';
    return 'normal';
  }, [task.due_date, task.status, allDone]);

  // Determine the "current" step index: first unchecked step after any checked ones
  const currentStepIndex = useMemo(() => {
    for (let i = 0; i < service.steps.length; i++) {
      const stepData = steps[service.steps[i].key];
      if (!stepData?.done) return i;
    }
    return -1; // all done
  }, [steps, service.steps]);
  const taxIds = getClientIds ? getClientIds(client, service.key) : [];
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDue, setNewSubDue] = useState('');
  const [newSubTime, setNewSubTime] = useState('');

  // Blocked-by reasons (dependency tooltip)
  const blockedByReasons = useMemo(() => getBlockedByReasons(task, allTasks), [task, allTasks]);

  // Energy tier computation
  const isVat = service.key === 'vat' || service.key === 'tax_advances' || service.key === 'vat_874';
  const isPayroll = service.key === 'payroll';
  const vatTier = isVat ? getVatEnergyTier(task) : null;
  const payrollTier = isPayroll && client ? getPayrollTier(client) : null;
  const isQuickWin = vatTier?.key === 'quick_win' || payrollTier?.key === 'nano';
  const isClimb = vatTier?.key === 'climb';

  // VAT readiness chips: surface whether the prep tasks (קליטת הכנסות /
  // קליטת הוצאות) for the same client+reporting_month are done. Lets the
  // user spot at a glance what's still blocking the VAT report without
  // hunting through the Tax dashboard. Only computed for VAT tasks.
  const vatPrepReadiness = useMemo(() => {
    if (!isVat) return null;
    const rm = task.reporting_month || '';
    if (!rm) return null;
    const pickStatus = (categoryName) => {
      const sibling = (allTasks || []).find(t =>
        t.client_name === task.client_name &&
        t.category === categoryName &&
        (t.reporting_month || '') === rm
      );
      if (!sibling) return 'missing';
      const steps = sibling.process_steps || {};
      // Reuses the same skip-flag/all-steps logic as the cascade so the
      // chip flips green at the same moment the task auto-completes.
      const sufficientDone = !!steps.sufficient_for_reporting?.done;
      const skipFlag = !!(steps.zero_income?.done || steps.zero_expenses?.done);
      if (sibling.status === 'production_completed' || sufficientDone || skipFlag) return 'done';
      return 'pending';
    };
    return {
      income:   pickStatus('קליטת הכנסות'),
      expense:  pickStatus('קליטת הוצאות'),
    };
  }, [isVat, task.client_name, task.reporting_month, allTasks]);

  const statusOptions = ['waiting_for_materials', 'not_started', 'sent_for_review', 'review_after_corrections', 'ready_to_broadcast', 'reported_pending_payment', 'needs_corrections', 'production_completed'];

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
    if (updated.every(st => st.done) && updated.length > 0 && task.status !== 'production_completed') {
      onStatusChange(task, 'production_completed');
    }
  };

  const handleDeleteSubTask = (subId) => {
    onSubTaskChange(task, subTasks.filter(st => st.id !== subId));
  };

  return (
    <>
      <tr
        ref={ref}
        {...(draggableProps || {})}
        className={`border-b border-gray-50 transition-colors ${rowUrgency === 'done' ? 'bg-gray-50' : rowUrgency === 'overdue' ? 'bg-amber-50/60' : rowUrgency === 'urgent' ? 'bg-amber-50/40' : ''} hover:bg-[#F5F5F5] ${isDragging ? 'shadow-lg bg-white z-50' : ''}`}
        style={{
          ...(draggableProps?.style || {}),
          borderRight: `3px solid ${accent.border}`,
          backgroundColor: isDragging ? '#FFF' : rowUrgency === 'done' ? '#F9FAFB' : rowUrgency === 'overdue' ? '#FEF3C7' : rowUrgency === 'urgent' ? '#FFFBEB' : accent.bg,
        }}
      >
        {bulkMode && (
          <td className="text-center px-2 py-1.5">
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect?.([task.id], !isSelected)}
              className="w-4 h-4 rounded border-violet-300 text-violet-600 accent-violet-600" />
          </td>
        )}
        {/* Drag handle + Client name + IDs */}
        <td className="py-1.5 px-4 sticky right-0 z-10" style={{ backgroundColor: isDragging ? '#FFF' : rowUrgency === 'done' ? '#F3F4F6' : rowUrgency === 'overdue' ? '#FEF3C7' : rowUrgency === 'urgent' ? '#FFFBEB' : accent.bg }}>
          <div className="flex items-center gap-1">
            <span {...(dragHandleProps || {})} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0" title="גרור לשינוי סדר">
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            <button
              onClick={() => setShowSubTasks(!showSubTasks)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              title="תת משימות"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSubTasks ? 'rotate-180' : ''}`} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                {task.reporting_month && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500" title={`חודש דיווח: ${task.reporting_month}`}>
                    {task.reporting_month.split('-')[1]?.replace(/^0/, '') || ''}
                  </span>
                )}
                <span className="truncate block max-w-[160px] font-bold text-gray-900 text-[13px]">{clientName}</span>
                {isQuickWin && task.status !== 'production_completed' && (
                  <span className="text-emerald-500 shrink-0" title="Quick Win">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                )}
                {isClimb && task.status !== 'production_completed' && (
                  <Badge className="text-[11px] px-1 py-0 bg-purple-100 text-purple-600 border-purple-200 shrink-0">45+</Badge>
                )}
                {/* VAT prep readiness — quick visual on each VAT row of
                    whether the prep tasks (קליטת הכנסות / קליטת הוצאות)
                    for the SAME client+reporting_month are done. Hover
                    each chip for the full state. */}
                {vatPrepReadiness && task.status !== 'production_completed' && (
                  <>
                    {(() => {
                      const STATE_STYLE = {
                        done:    { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: '✓', tip: 'הושלם' },
                        pending: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: '◯', tip: 'בעבודה' },
                        missing: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: '✕', tip: 'לא קיימת — צריך להזריק' },
                      };
                      const inc = STATE_STYLE[vatPrepReadiness.income];
                      const exp = STATE_STYLE[vatPrepReadiness.expense];
                      return (
                        <>
                          <Badge className={`text-[10px] px-1 py-0 shrink-0 border ${inc.bg} ${inc.text} ${inc.border}`}
                            title={`קליטת הכנסות — ${inc.tip}`}>
                            הכנסות {inc.icon}
                          </Badge>
                          <Badge className={`text-[10px] px-1 py-0 shrink-0 border ${exp.bg} ${exp.text} ${exp.border}`}
                            title={`קליטת הוצאות — ${exp.tip}`}>
                            הוצאות {exp.icon}
                          </Badge>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
              {taxIds.length > 0 && (
                <div className="flex gap-2 mt-0.5">
                  {taxIds.map(({ label, value }) => (
                    <span key={label} className="text-[12px] text-gray-400 cursor-pointer hover:text-blue-500 transition-colors"
                      title="לחץ להעתקה"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); }}
                    >
                      <span className="font-medium">{label}:</span> {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {subTasks.length > 0 && (
              <Badge className="text-[12px] px-1 py-0 bg-indigo-100 text-indigo-600 shrink-0">
                {subTasks.filter(s => s.done).length}/{subTasks.length}
              </Badge>
            )}
            {/* Stage 5.8: the paperclip is now a clickable Popover trigger
                so users can upload / preview files directly from the row,
                without expanding into the detail view. Count chip appears
                only when there are existing attachments. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-gray-400 hover:text-gray-700 shrink-0 rounded hover:bg-gray-100 px-1 py-0.5"
                  title={`${(task.attachments || []).length} קבצים`}
                  aria-label="קבצים מצורפים"
                >
                  <Paperclip className="w-3 h-3" />
                  {(task.attachments || []).length > 0 && (
                    <span className="text-[10px] font-semibold">{task.attachments.length}</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-3"
                align="center"
                side="top"
                onClick={(e) => e.stopPropagation()}
              >
                <TaskFileAttachments
                  taskId={task.id}
                  attachments={task.attachments || []}
                  onUpdate={(updated) => onAttachmentUpdate(task, updated)}
                  clientId={task.client_id}
                  clientName={task.client_name}
                />
              </PopoverContent>
            </Popover>
            {task.notes && (
              <span className="text-amber-400 shrink-0" title={task.notes}>
                <StickyNote className="w-3 h-3" />
              </span>
            )}
            {(() => {
              const cl = task.cognitiveLoad ?? task.cognitive_load;
              const cfg = cl ? COGNITIVE_LOAD_CONFIG[cl] : null;
              if (!cfg) return null;
              return (
                <span className="shrink-0" title={`עומס: ${cfg.label}`}>
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
                </span>
              );
            })()}
            {(() => {
              if (!task.due_date) return null;
              const d = parseISO(task.due_date);
              if (!isValid(d)) return null;
              const t = new Date(); t.setHours(0,0,0,0);
              const rem = differenceInDays(d, t);
              if (rem < 0) return <Badge className="text-[12px] px-1 py-0 bg-amber-100 text-amber-700 shrink-0">-{Math.abs(rem)}d</Badge>;
              if (rem <= 3) return <Badge className="text-[12px] px-1 py-0 bg-amber-100 text-amber-700 shrink-0">{rem}d</Badge>;
              return null;
            })()}
            {service.key === 'payroll' && onReserveToggle && (() => {
              const reportingMonth = task.reporting_month || (task.due_date ? (() => {
                const d = parseISO(task.due_date);
                if (!isValid(d)) return null;
                const m = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
                const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
                return `${y}-${String(m + 1).padStart(2, '0')}`;
              })() : null);
              const reserveTask = reserveTasks.find(rt =>
                rt.client_name === clientName && rt.reporting_month === reportingMonth
              );
              const hasReserve = !!reserveTask;
              const started = reserveTask && (
                (reserveTask.status && reserveTask.status !== 'waiting_for_materials' && reserveTask.status !== 'not_started') ||
                Object.values(reserveTask.process_steps || {}).some((s) => s?.done)
              );
              const disabled = started; // locked once work began
              const handleClick = (e) => {
                e.stopPropagation();
                if (disabled) return;
                onReserveToggle(task, reserveTask, reportingMonth);
              };
              if (hasReserve) {
                return (
                  <button
                    type="button"
                    onClick={handleClick}
                    disabled={disabled}
                    className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                      disabled
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-not-allowed'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    }`}
                    title={disabled ? 'משימת מילואים כבר החלה — לא ניתן להסיר' : 'לחץ להסרת משימת המילואים לחודש זה'}
                  >
                    {disabled ? <Lock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                    מילואים
                  </button>
                );
              }
              return (
                <button
                  type="button"
                  onClick={handleClick}
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold border border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="סמן אם היה מילואים החודש — תיווצר משימת דיווח מילואים לב״ל"
                >
                  <Shield className="w-3 h-3" />
                  מילואים?
                </button>
              );
            })()}
          </div>
        </td>

        {/* Step cells (with sub-step support) */}
        {service.steps.map((stepDef, stepIdx) => {
          const subs = stepDef.sub_steps || [];
          const stepData = steps[stepDef.key] || { done: false, date: null };
          const isCurrent = stepIdx === currentStepIndex;

          if (subs.length === 0) {
            return (
              <td
                key={stepDef.key}
                className="py-1.5 px-2 text-center"
                style={isCurrent ? { backgroundColor: accent.border + '18', boxShadow: `inset 0 0 0 1px ${accent.border}40` } : stepData.done ? { backgroundColor: '#F3F4F6' } : {}}
              >
                <StepCell
                  stepData={stepData}
                  isCurrent={isCurrent}
                  accent={accent}
                  onToggle={() => onToggleStep(task, stepDef.key)}
                  onDateChange={(date) => onDateChange(task, stepDef.key, date)}
                />
              </td>
            );
          }

          // Step has sub-steps: show mini progress
          const subsDone = subs.filter(s => {
            const sd = steps[`${stepDef.key}.${s.key}`];
            return sd?.done || sd?.skipped;
          }).length;
          const allSubsDone = subsDone === subs.length;

          return (
            <td
              key={stepDef.key}
              className="py-1.5 px-2 text-center"
              style={isCurrent ? { backgroundColor: accent.border + '18', boxShadow: `inset 0 0 0 1px ${accent.border}40` } : allSubsDone ? { backgroundColor: '#F3F4F6' } : {}}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`w-8 h-8 mx-auto rounded-md border-2 flex items-center justify-center text-[12px] font-bold transition-all ${
                    allSubsDone
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : subsDone > 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-dashed border-gray-200 hover:border-emerald-400 text-gray-400'
                  }`}>
                    {allSubsDone ? <Check className="w-4 h-4" /> : `${subsDone}/${subs.length}`}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="center" side="top">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-700 mb-1.5">{stepDef.label}</div>
                    {subs.map(sub => {
                      const subData = steps[`${stepDef.key}.${sub.key}`] || { done: false };
                      return (
                        <button
                          key={sub.key}
                          onClick={() => onToggleStep(task, `${stepDef.key}.${sub.key}`)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-right"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            subData.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                          }`}>
                            {subData.done && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-xs ${subData.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {sub.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </td>
          );
        })}

        {/* Status + payment date */}
        <td className="py-1.5 px-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <Popover open={showStatusMenu} onOpenChange={setShowStatusMenu}>
              <PopoverTrigger asChild>
                <button className="cursor-pointer">
                  <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[12px] px-1.5 py-0.5 font-semibold hover:opacity-80 transition-opacity`}>
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
                        {s === 'production_completed' && <span className="text-[12px] text-gray-400 mr-auto">(+כל השלבים)</span>}
                      </button>
                    );
                  })}
                </div>
                {task.status === 'reported_waiting_for_payment' && (
                  <div className="border-t mt-1 pt-2 px-2 pb-1">
                    <label className="text-[12px] text-gray-500 block mb-1">תאריך יעד לתשלום:</label>
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
            {blockedByReasons.length > 0 && (
              <span className={`text-[10px] rounded px-1.5 py-0.5 leading-tight max-w-[120px] truncate ${
                task.status === 'reported_pending_payment'
                  ? 'text-indigo-600 bg-indigo-50 border border-indigo-200'
                  : 'text-amber-600 bg-amber-50 border border-amber-200'
              }`}
                title={blockedByReasons.join(', ')}
              >
                {blockedByReasons.join(', ')}
              </span>
            )}
            {task.status === 'reported_waiting_for_payment' && task.payment_due_date && (
              <span className="text-[12px] text-yellow-700 font-medium">
                תשלום: {new Date(task.payment_due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </td>
        {/* Notes — in main row, always visible */}
        <td className="py-1.5 px-2 text-right align-top" style={{ minWidth: '100px' }}>
          <NotesCell taskId={task.id} initialNotes={task.notes || ''} />
        </td>
      </tr>
      {/* Sub-tasks row */}
      {showSubTasks && (
        <tr className="bg-indigo-50">
          <td colSpan={service.steps.length + 2 + (bulkMode ? 1 : 0)} className="px-4 py-2">
            <div className="space-y-1.5 mr-6">
              {/* Task notes preview */}
              {task.notes && (
                <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 flex items-start gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">{task.notes}</p>
                </div>
              )}
              {/* Fast-Track button for nano payroll */}
              {payrollTier?.fastTrack && task.status !== 'production_completed' && (
                <button
                  onClick={() => onStatusChange(task, 'production_completed')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  <FastForward className="w-4 h-4" />
                  Fast-Track - סיום מהיר (Nano {payrollTier.emoji})
                </button>
              )}
              {/* Climb task progress bar */}
              {isClimb && task.status !== 'production_completed' && (
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
                  {st.due_time && <span className="text-[12px] text-blue-400">{st.due_time}</span>}
                  {st.due_date && <span className="text-[12px] text-gray-400">{new Date(st.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>}
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
                        <div key={label} className="text-[11px] flex items-center gap-1 cursor-pointer group/tax"
                          onClick={() => { navigator.clipboard.writeText(value); }}
                          title="לחץ להעתקה"
                        >
                          <span className="text-blue-500">{label}:</span>{' '}
                          <span className="font-mono font-medium text-blue-900 select-all">{value}</span>
                          <Copy className="w-2.5 h-2.5 text-blue-300 opacity-0 group-hover/tax:opacity-100 transition-opacity" />
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
});

// =====================================================
// STEP CELL
// =====================================================

function StepCell({ stepData, isCurrent, accent, onToggle, onDateChange }) {
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
        className={`w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center group transition-all ${
          isCurrent
            ? 'border-solid animate-pulse'
            : 'border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
        }`}
        style={isCurrent ? { borderColor: accent?.border || '#94A3B8', backgroundColor: (accent?.border || '#94A3B8') + '15' } : {}}
      >
        <div
          className={`w-3 h-3 rounded-full transition-colors ${
            isCurrent ? 'opacity-60' : 'bg-gray-200 group-hover:bg-emerald-300'
          }`}
          style={isCurrent ? { backgroundColor: accent?.border || '#94A3B8' } : {}}
        />
      </button>
    );
  }

  return (
    <Popover open={editingDate} onOpenChange={setEditingDate}>
      <PopoverTrigger asChild>
        <button className="w-full mx-auto flex flex-col items-center gap-0 group">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm group-hover:bg-emerald-600 transition-colors">
            <Check className="w-4 h-4 text-white" />
          </div>
          {stepData.date && (
            <span className="text-[12px] text-emerald-600 font-medium mt-0.5 leading-none">
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
