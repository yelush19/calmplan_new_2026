import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, Calendar, Briefcase, Home, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { STATUS_CONFIG } from '@/config/processTemplates';

const columnMapping = {
  todo: ['not_started', 'postponed', 'waiting_for_materials', 'issue'],
  in_progress: ['in_progress', 'remaining_completions', 'waiting_for_approval', 'ready_for_reporting', 'reported_waiting_for_payment'],
  completed: ['completed', 'not_relevant'],
};

const columnsConfig = {
  todo: { title: 'טרם התחיל', color: 'bg-gray-100', tasks: [] },
  in_progress: { title: 'בביצוע', color: 'bg-blue-100', tasks: [] },
  completed: { title: 'הושלם', color: 'bg-green-100', tasks: [] },
};

// Statuses that are collapsed by default inside columns
const DEFAULT_COLLAPSED_STATUSES = new Set(['completed', 'not_relevant']);

const statusOptions = Object.fromEntries(
  Object.entries(STATUS_CONFIG)
    .filter(([k]) => k !== 'issues')
    .map(([k, cfg]) => [k, { text: cfg.label, dot: cfg.bg }])
);

const getPriorityColor = (priority) => {
  const colors = {
    low: "border-r-4 border-gray-400",
    medium: "border-r-4 border-yellow-500",
    high: "border-r-4 border-orange-500",
    urgent: "border-r-4 border-red-600",
  };
  return colors[priority] || "border-r-4 border-gray-300";
};

const TaskCard = ({ task, index, onStatusChange, onDelete, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[task?.status] || STATUS_CONFIG.not_started;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'd MMM', { locale: he }) : null;
    } catch {
      return null;
    }
  };

  if (!task || !task.id) {
    return null;
  }

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
        >
          {/* Card header - clickable to expand */}
          <div
            className="p-3 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-semibold text-sm text-gray-800 flex-1">{task.title || 'משימה ללא כותרת'}</h4>
              <div className="flex items-center gap-1 shrink-0">
                {task.context === 'work' ? <Briefcase className="w-3.5 h-3.5 text-blue-600"/> : <Home className="w-3.5 h-3.5 text-green-600"/>}
                {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </div>
            {/* Status + meta - always visible */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px] px-1.5 py-0 font-semibold border ${statusCfg.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot || statusCfg.bg} mr-1`} />
                {statusCfg.label}
              </Badge>
              {task.client_name && (
                <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{task.client_name}</span>
              )}
              {task.category && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{task.category}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
              {formatDate(task.due_date) && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3"/>
                  {formatDate(task.due_date)}
                </div>
              )}
              {task.estimated_duration && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3"/>
                  {task.estimated_duration} דק'
                </div>
              )}
              {task.assigned_to && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3"/>
                  {task.assigned_to}
                </div>
              )}
            </div>
          </div>

          {/* Expanded section - status change + details */}
          {expanded && (
            <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2">
              {task.description && (
                <p className="text-xs text-gray-600">{task.description}</p>
              )}

              {/* Status dropdown */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Select
                  value={task.status}
                  onValueChange={(newStatus) => onStatusChange && onStatusChange(task, newStatus)}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-blue-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(task);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task.id);
                      }}
                    >
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

export default function KanbanView({ tasks = [], onTaskStatusChange, onDeleteTask, onEditTask }) {
  const [board, setBoard] = useState(columnsConfig);
  const [collapsed, setCollapsed] = useState({ completed: true });
  const [collapsedStatuses, setCollapsedStatuses] = useState(() => {
    const init = {};
    DEFAULT_COLLAPSED_STATUSES.forEach(s => { init[s] = true; });
    return init;
  });

  const toggleCollapsed = (colId) => {
    setCollapsed(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  const toggleStatusGroup = (status) => {
    setCollapsedStatuses(prev => ({ ...prev, [status]: !prev[status] }));
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

    // Sort each column: nearest due_date first
    const sortByDueDate = (a, b) => (a.due_date || '9999') .localeCompare(b.due_date || '9999');
    newBoard.todo.tasks.sort(sortByDueDate);
    newBoard.in_progress.tasks.sort(sortByDueDate);
    newBoard.completed.tasks.sort(sortByDueDate);

    setBoard(newBoard);
  }, [tasks]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;

    if (sourceColumnId === destColumnId && source.index === destination.index) {
      return;
    }

    const validTasks = Array.isArray(tasks) ? tasks : [];
    const taskToMove = validTasks.find(t => t && t.id === draggableId);

    if (!taskToMove) return;

    const newStatus = columnMapping[destColumnId] ? columnMapping[destColumnId][0] : 'not_started';

    if (onTaskStatusChange) {
      onTaskStatusChange(taskToMove, newStatus);
    }
  };

  if (!Array.isArray(tasks)) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">טוען משימות...</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(board).map(([columnId, column]) => {
          const isCollapsed = !!collapsed[columnId];
          const taskCount = Array.isArray(column.tasks) ? column.tasks.length : 0;
          return (
          <Droppable droppableId={columnId} key={columnId}>
            {(provided, snapshot) => (
              <Card className={`flex flex-col ${column.color}`}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => toggleCollapsed(columnId)}
                >
                  <CardTitle className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? 'rotate-[-90deg]' : ''}`} />
                      <span>{column.title}</span>
                    </div>
                    <Badge variant="secondary">
                      {taskCount}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                {!isCollapsed ? (
                  <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-grow p-4 transition-colors min-h-[200px] ${snapshot.isDraggingOver ? 'bg-opacity-80' : ''}`}
                  >
                    {(() => {
                      const statusOrder = columnMapping[columnId];
                      const tasksByStatus = {};
                      statusOrder.forEach(s => { tasksByStatus[s] = []; });
                      (column.tasks || []).forEach(task => {
                        const s = task.status || statusOrder[0];
                        if (tasksByStatus[s]) tasksByStatus[s].push(task);
                      });

                      // Always show sub-group headers so users see status breakdown in every column
                      let runningIndex = 0;
                      return statusOrder.map(status => {
                        const statusTasks = tasksByStatus[status] || [];
                        if (statusTasks.length === 0) return null;
                        const isStatusCollapsed = !!collapsedStatuses[status];
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
                        const startIdx = runningIndex;
                        if (!isStatusCollapsed) {
                          runningIndex += statusTasks.length;
                        }

                        return (
                          <div key={status} className="mb-2">
                            {/* Sub-group header */}
                            <button
                              type="button"
                              onClick={() => toggleStatusGroup(status)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/60 hover:bg-white/80 transition-colors mb-1.5"
                            >
                              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isStatusCollapsed ? 'rotate-[-90deg]' : ''}`} />
                              <Badge className={`${cfg.bg} ${cfg.text} text-[10px] px-1.5 py-0 font-semibold border ${cfg.border}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot || cfg.bg} mr-1`} />
                                {cfg.label}
                              </Badge>
                              <span className="text-[10px] text-gray-500 font-medium">{statusTasks.length}</span>
                            </button>
                            {/* Tasks in this sub-group */}
                            {!isStatusCollapsed && statusTasks.map((task, i) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                index={startIdx + i}
                                onStatusChange={onTaskStatusChange}
                                onDelete={onDeleteTask}
                                onEdit={onEditTask}
                              />
                            ))}
                          </div>
                        );
                      });
                    })()}
                    {provided.placeholder}

                    {taskCount === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <p>אין משימות</p>
                      </div>
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
    </DragDropContext>
  );
}
