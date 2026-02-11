import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Clock, User, Calendar, Briefcase, Home } from 'lucide-react';
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

const getPriorityColor = (priority) => {
  const colors = {
    low: "border-l-4 border-gray-400",
    medium: "border-l-4 border-yellow-500",
    high: "border-l-4 border-orange-500",
    urgent: "border-l-4 border-red-600",
  };
  return colors[priority] || "border-l-4 border-gray-300";
};

const TaskCard = ({ task, index }) => {
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
          className={`mb-3 p-4 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(task.priority)} ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
        >
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-gray-800">{task.title || 'משימה ללא כותרת'}</h4>
            {task.context === 'work' ? <Briefcase className="w-4 h-4 text-blue-600"/> : <Home className="w-4 h-4 text-green-600"/>}
          </div>
          {task.description && <p className="text-sm text-gray-600 my-2">{task.description}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
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
      )}
    </Draggable>
  );
};

export default function KanbanView({ tasks = [], onTaskStatusChange }) {
  const [board, setBoard] = useState(columnsConfig);

  useEffect(() => {
    // Ensure tasks is always an array
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

    // Ensure tasks is an array before using find
    const validTasks = Array.isArray(tasks) ? tasks : [];
    const taskToMove = validTasks.find(t => t && t.id === draggableId);
    
    if (!taskToMove) return;

    // Determine the primary status for the destination column
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
                    <TaskCard key={task.id} task={task} index={index} />
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