import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, Calendar, Briefcase, Home, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';

const columnMapping = {
  todo: ['not_started', 'postponed', 'waiting_for_materials'],
  in_progress: ['in_progress'],
  completed: ['completed'],
};

const columnsConfig = {
  todo: { title: 'לביצוע', color: 'bg-gray-100', tasks: [] },
  in_progress: { title: 'בביצוע', color: 'bg-blue-100', tasks: [] },
  completed: { title: 'הושלם', color: 'bg-green-100', tasks: [] },
};

const statusOptions = {
  not_started: { text: 'לביצוע', dot: 'bg-gray-400' },
  in_progress: { text: 'בעבודה', dot: 'bg-sky-500' },
  completed: { text: 'הושלם', dot: 'bg-emerald-500' },
  postponed: { text: 'נדחה', dot: 'bg-neutral-400' },
  waiting_for_approval: { text: 'לבדיקה', dot: 'bg-purple-500' },
  waiting_for_materials: { text: 'ממתין לחומרים', dot: 'bg-amber-500' },
  issue: { text: 'בעיה', dot: 'bg-pink-500' },
  ready_for_reporting: { text: 'מוכן לדיווח', dot: 'bg-teal-500' },
  reported_waiting_for_payment: { text: 'ממתין לתשלום', dot: 'bg-yellow-500' },
  not_relevant: { text: 'לא רלוונטי', dot: 'bg-gray-300' },
};

const getPriorityColor = (priority) => {
  const colors = {
    low: "border-r-4 border-gray-400",
    medium: "border-r-4 border-yellow-500",
    high: "border-r-4 border-orange-500",
    urgent: "border-r-4 border-red-600",
  };
  return colors[priority] || "border-r-4 border-gray-300";
};

const TaskCard = ({ task, index, onStatusChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

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
              {task.client_name && (
                <div className="text-xs text-gray-500">
                  לקוח: <span className="font-medium text-gray-700">{task.client_name}</span>
                </div>
              )}
              {task.category && (
                <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>
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
          )}
        </div>
      )}
    </Draggable>
  );
};

export default function KanbanView({ tasks = [], onTaskStatusChange, onDeleteTask }) {
  const [board, setBoard] = useState(columnsConfig);

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
        {Object.entries(board).map(([columnId, column]) => (
          <Droppable droppableId={columnId} key={columnId}>
            {(provided, snapshot) => (
              <Card className={`flex flex-col ${column.color}`}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{column.title}</span>
                    <Badge variant="secondary">
                      {Array.isArray(column.tasks) ? column.tasks.length : 0}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-grow p-4 transition-colors min-h-[200px] ${snapshot.isDraggingOver ? 'bg-opacity-80' : ''}`}
                >
                  {Array.isArray(column.tasks) && column.tasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={index}
                      onStatusChange={onTaskStatusChange}
                      onDelete={onDeleteTask}
                    />
                  ))}
                  {provided.placeholder}

                  {(!column.tasks || column.tasks.length === 0) && (
                    <div className="text-center text-gray-400 py-8">
                      <p>אין משימות</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
