import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, Calendar, Briefcase, Home, Trash2, Pencil, ChevronDown, ChevronUp, Zap, FastForward, Plus, GitBranchPlus, Users, Layers } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { STATUS_CONFIG } from '@/config/processTemplates';
import { getVatEnergyTier, getPayrollTier } from '@/engines/taskCascadeEngine';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';

// ============================================================
// Column mapping: status → kanban column
// ============================================================
// 5 Golden Statuses → 3 Kanban columns
const columnMapping = {
  todo: ['waiting_for_materials', 'not_started', 'needs_corrections'],
  in_progress: ['sent_for_review'],
  completed: ['production_completed'],
};

const columnsConfig = {
  todo: { title: 'לבצע', color: 'bg-slate-50', headerColor: 'bg-slate-200', tasks: [] },
  in_progress: { title: 'הועבר לעיון', color: 'bg-purple-50', headerColor: 'bg-purple-200', tasks: [] },
  completed: { title: 'הושלם ייצור', color: 'bg-emerald-50', headerColor: 'bg-emerald-200', tasks: [] },
};

// ============================================================
// Hebrew category labels — replace English keys
// ============================================================
const CATEGORY_HEBREW = {
  'work_vat_reporting': 'מע"מ',
  'work_tax_advances': 'מקדמות מס',
  'work_payroll': 'שכר',
  'work_social_security': 'ביטוח לאומי',
  'work_deductions': 'ניכויים',
  'work_reconciliation': 'התאמות חשבונות',
  'work_bookkeeping': 'הנהלת חשבונות',
  'work_consulting': 'ייעוץ',
  'work_admin': 'אדמיניסטרציה',
  'work_general': 'כללי',
  'work_masav': 'מס"ב',
  'work_masav_social': 'מס"ב סוציאליות',
  'work_reserve_claims': 'מילואים',
  'work_annual_reports': 'דוח שנתי',
  'work_vat_874': 'מע"מ 874',
  'work_client_management': 'ניהול לקוחות',
  'work_marketing': 'שיווק',
  'work_callback': 'לחזור ללקוח',
  'work_meeting': 'פגישה',
  'work_payslip_sending': 'משלוח תלושים',
  'work_masav_employees': 'מס"ב עובדים',
  'work_masav_authorities': 'מס"ב רשויות',
  'work_masav_suppliers': 'מס"ב ספקים',
  'work_operator_reporting': 'דיווח למתפעל',
  'work_taml_reporting': 'דיווח לטמל',
};

function hebrewCategory(cat) {
  return CATEGORY_HEBREW[cat] || cat;
}

// ============================================================
// Grouping options
// ============================================================
const GROUP_OPTIONS = [
  { value: 'none', label: 'ללא קיבוץ' },
  { value: 'client', label: 'לפי לקוח' },
  { value: 'branch', label: 'לפי ענף (P1/P2)' },
];

function getTaskBranch(task) {
  if (task.branch) return task.branch;
  const cat = task.category || '';
  if (['שכר', 'work_payroll', 'ביטוח לאומי', 'work_social_security', 'ניכויים', 'work_deductions'].includes(cat)) return 'P1';
  if (['מע"מ', 'work_vat_reporting', 'מקדמות מס', 'work_tax_advances', 'התאמות', 'work_reconciliation', 'הנהלת חשבונות', 'work_bookkeeping'].includes(cat)) return 'P2';
  return 'אחר';
}

const statusOptions = Object.fromEntries(
  Object.entries(STATUS_CONFIG)
    .map(([k, cfg]) => [k, { text: cfg.label, dot: cfg.bg }])
);

const getPriorityColor = (priority) => {
  const colors = {
    low: "border-r-4 border-gray-400",
    medium: "border-r-4 border-yellow-500",
    high: "border-r-4 border-orange-500",
    urgent: "border-r-4 border-amber-600",
  };
  return colors[priority] || "border-r-4 border-gray-300";
};

// ============================================================
// Compact Task Card — Hebrew only, clear info
// ============================================================
const TaskCard = ({ task, index, onStatusChange, onDelete, onEdit, clients, allTasks = [], onAddSubTask }) => {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[task?.status] || STATUS_CONFIG.not_started;

  const isPayroll = task?.category === 'שכר' || task?.category === 'work_payroll';
  const payrollClient = isPayroll && clients ? clients.find(c => c.name === task?.client_name) : null;
  const payrollTier = payrollClient ? getPayrollTier(payrollClient) : null;
  const isQuickWin = payrollTier?.key === 'nano';

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'd/MM', { locale: he }) : null;
    } catch { return null; }
  };

  if (!task || !task.id) return null;

  const displayCategory = hebrewCategory(task.category);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
        >
          <div className="p-2.5 cursor-pointer" onClick={() => { if (onEdit) { onEdit(task); } else { setExpanded(!expanded); } }}>
            {/* Row 1: Client name + due date */}
            <div className="flex justify-between items-center gap-1">
              <span className="font-bold text-xs text-gray-800 truncate">
                {task.client_name || 'ללא לקוח'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {formatDate(task.due_date || task.date) && (
                  <span className="text-[10px] text-gray-500 font-medium">
                    {formatDate(task.due_date || task.date)}
                  </span>
                )}
                {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
              </div>
            </div>
            {/* Row 2: Category + status */}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                {displayCategory}
              </Badge>
              {isQuickWin && (
                <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1 py-0 border border-emerald-300 gap-0.5">
                  <Zap className="w-2.5 h-2.5" />סיום מהיר
                </Badge>
              )}
              {task.status === 'production_completed' && (
                <Badge className="bg-sky-100 text-sky-700 text-[9px] px-1 py-0 border border-sky-300">
                  הושלם ייצור
                </Badge>
              )}
            </div>
          </div>

          {/* Expanded section */}
          {expanded && (
            <div className="px-2.5 pb-2.5 border-t border-gray-100 pt-2 space-y-2">
              {task.title && (
                <p className="text-[11px] text-gray-600">{task.title}</p>
              )}

              {payrollTier?.fastTrack && task.status !== 'completed' && task.status !== 'production_completed' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange?.(task, 'completed'); }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />סיום מהיר
                </button>
              )}

              {/* Child tasks */}
              {(() => {
                const childCount = allTasks.filter(t => t.parent_id === task.id || t.master_task_id === task.id).length;
                return childCount > 0 ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-violet-600 border-violet-200">
                    <GitBranchPlus className="w-3 h-3" />{childCount} תת-משימות
                  </Badge>
                ) : null;
              })()}

              {/* Status dropdown */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Select
                  value={task.status}
                  onValueChange={(newStatus) => onStatusChange?.(task, newStatus)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 bg-gray-50 border-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${statusOptions[task.status]?.dot || 'bg-gray-400'}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {Object.entries(statusOptions).map(([key, { text, dot }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dot}`} />
                          {text}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-500"
                      onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-amber-500"
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

// ============================================================
// Main KanbanView
// ============================================================
export default function KanbanView({ tasks = [], onTaskStatusChange, onDeleteTask, onEditTask, clients = [], onTaskCreated }) {
  const [board, setBoard] = useState(columnsConfig);
  const [collapsed, setCollapsed] = useState({});
  const [subTaskParent, setSubTaskParent] = useState(null);
  const [groupBy, setGroupBy] = useState('none');

  const toggleCollapsed = (colId) => {
    setCollapsed(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  useEffect(() => {
    const validTasks = Array.isArray(tasks) ? tasks : [];

    const newBoard = {
      todo: { ...columnsConfig.todo, tasks: [] },
      in_progress: { ...columnsConfig.in_progress, tasks: [] },
      completed: { ...columnsConfig.completed, tasks: [] },
    };

    validTasks.forEach(task => {
      if (!task || !task.status) return;
      if (columnMapping.todo.includes(task.status)) {
        newBoard.todo.tasks.push(task);
      } else if (columnMapping.in_progress.includes(task.status)) {
        newBoard.in_progress.tasks.push(task);
      } else if (columnMapping.completed.includes(task.status)) {
        newBoard.completed.tasks.push(task);
      }
    });

    // Sort: nearest due_date first
    const sortByDueDate = (a, b) => (a.due_date || a.date || '9999').localeCompare(b.due_date || b.date || '9999');
    newBoard.todo.tasks.sort(sortByDueDate);
    newBoard.in_progress.tasks.sort(sortByDueDate);
    newBoard.completed.tasks.sort(sortByDueDate);

    setBoard(newBoard);
  }, [tasks]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const validTasks = Array.isArray(tasks) ? tasks : [];
    const taskToMove = validTasks.find(t => t && t.id === draggableId);
    if (!taskToMove) return;

    const newStatus = columnMapping[destination.droppableId]?.[0] || 'not_started';
    onTaskStatusChange?.(taskToMove, newStatus);
  };

  // Group tasks within a column by swimlane
  function groupTasks(columnTasks) {
    if (groupBy === 'none') return [{ key: '__all', label: null, tasks: columnTasks }];

    const groups = {};
    columnTasks.forEach(task => {
      const key = groupBy === 'client' ? (task.client_name || 'ללא לקוח')
        : getTaskBranch(task);
      if (!groups[key]) groups[key] = { key, label: key, tasks: [] };
      groups[key].tasks.push(task);
    });

    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label, 'he'));
  }

  if (!Array.isArray(tasks)) {
    return <div className="text-center p-8"><p className="text-gray-500">טוען משימות...</p></div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">קיבוץ:</span>
          <div className="flex bg-white rounded-lg p-0.5 shadow-sm border text-xs">
            {GROUP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  groupBy === opt.value
                    ? 'bg-primary text-white'
                    : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {tasks.length} משימות
        </div>
      </div>

      {/* 3-column horizontal kanban */}
      <div className="grid grid-cols-3 gap-4 min-h-[400px]">
        {Object.entries(board).map(([columnId, column]) => {
          const isCollapsed = !!collapsed[columnId];
          const taskCount = column.tasks?.length || 0;
          const groups = groupTasks(column.tasks || []);

          return (
            <Droppable droppableId={columnId} key={columnId}>
              {(provided, snapshot) => (
                <Card className={`flex flex-col ${column.color} overflow-hidden`}>
                  <CardHeader
                    className={`cursor-pointer select-none py-2.5 px-3 ${column.headerColor}`}
                    onClick={() => toggleCollapsed(columnId)}
                  >
                    <CardTitle className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform ${isCollapsed ? 'rotate-[-90deg]' : ''}`} />
                        <span>{column.title}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{taskCount}</Badge>
                    </CardTitle>
                  </CardHeader>
                  {!isCollapsed ? (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-grow p-3 overflow-y-auto max-h-[65vh] transition-colors ${snapshot.isDraggingOver ? 'bg-opacity-80' : ''}`}
                    >
                      {groups.map(group => {
                        // Count for drag indexing
                        let runningIdx = 0;
                        const prevGroups = groups.slice(0, groups.indexOf(group));
                        prevGroups.forEach(g => { runningIdx += g.tasks.length; });

                        return (
                          <div key={group.key} className={group.label ? 'mb-3' : ''}>
                            {/* Swimlane header */}
                            {group.label && (
                              <div className="flex items-center gap-1.5 px-1 py-1 mb-1.5 border-b border-gray-200">
                                {groupBy === 'client' ? <Users className="w-3 h-3 text-gray-400" /> : <Layers className="w-3 h-3 text-gray-400" />}
                                <span className="text-[11px] font-bold text-gray-600">{group.label}</span>
                                <span className="text-[10px] text-gray-400">({group.tasks.length})</span>
                              </div>
                            )}
                            {group.tasks.map((task, i) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                index={runningIdx + i}
                                onStatusChange={onTaskStatusChange}
                                onDelete={onDeleteTask}
                                onEdit={onEditTask}
                                clients={clients}
                                allTasks={tasks}
                                onAddSubTask={setSubTaskParent}
                              />
                            ))}
                          </div>
                        );
                      })}
                      {provided.placeholder}
                      {taskCount === 0 && (
                        <div className="text-center text-gray-400 py-6 text-xs">אין משימות</div>
                      )}
                    </CardContent>
                  ) : (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="hidden">
                      {provided.placeholder}
                    </div>
                  )}
                </Card>
              )}
            </Droppable>
          );
        })}
      </div>

      {/* Sub-task dialog */}
      <QuickAddTaskDialog
        open={!!subTaskParent}
        onOpenChange={(val) => { if (!val) setSubTaskParent(null); }}
        defaultParentId={subTaskParent?.id || null}
        defaultClientId={subTaskParent?.client_id || null}
        lockedParent={true}
        lockedClient={!!subTaskParent?.client_id}
        onCreated={() => { setSubTaskParent(null); onTaskCreated?.(); }}
      />
    </DragDropContext>
  );
}
