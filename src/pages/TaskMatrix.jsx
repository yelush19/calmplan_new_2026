import React, { useState, useEffect } from 'react';
import { Task } from '@/api/entities';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Clock, Home, Briefcase, Pencil, Trash2 } from 'lucide-react';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const importanceColors = {
    high: 'border-r-4 border-red-500',
    medium: 'border-r-4 border-orange-500',
    low: 'border-r-4 border-blue-500',
};

const priorityColors = {
    urgent: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
};

const DraggableTaskItem = ({ task, index, onEdit, onDelete }) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group p-3 mb-2 rounded-lg shadow-sm cursor-grab ${snapshot.isDragging ? 'opacity-50' : 'opacity-100'} ${importanceColors[task.importance]}`}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            ...provided.draggableProps.style,
          }}
        >
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">{task.title}</h4>
            <div className="flex items-center gap-1">
              <div className="hidden group-hover:flex items-center gap-1">
                {onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1 rounded hover:bg-blue-100 transition-colors" title="עריכת משימה">
                    <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600" />
                  </button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(task); }} className="p-1 rounded hover:bg-red-100 transition-colors" title="מחק משימה">
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                  </button>
                )}
              </div>
              {task.context === 'work' ? <Briefcase className="w-4 h-4 text-blue-500"/> : <Home className="w-4 h-4 text-green-500"/>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
              <Badge variant="outline" className={priorityColors[task.priority]}>{task.priority}</Badge>
              {task.estimated_minutes && <div className="flex items-center gap-1"><Clock className="w-3 h-3"/> {task.estimated_minutes} דק'</div>}
          </div>
        </div>
      )}
    </Draggable>
  );
};

const DroppableQuadrant = ({ quadrant, tasks, onEdit, onDelete }) => {
  return (
    <div className={`rounded-xl shadow-lg h-[400px] flex flex-col bg-white/80`}>
      <CardHeader className={`border-b-4 border-${quadrant.color}-400 rounded-t-xl`}>
        <CardTitle className={`text-xl font-bold text-${quadrant.color}-700`}>{quadrant.title}</CardTitle>
        <p className="text-sm text-gray-500">{quadrant.description}</p>
      </CardHeader>
      <Droppable droppableId={quadrant.id}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-2 pt-4 flex-grow overflow-y-auto rounded-b-xl ${snapshot.isDraggingOver ? `bg-${quadrant.color}-100` : ''}`}
          >
            {tasks.map((task, index) => (
              <DraggableTaskItem key={task.id} task={task} index={index} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </div>
  );
};

export default function TaskMatrixPage() {
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    const allTasks = await Task.filter({ status: { '$ne': 'completed' } });
    setTasks(allTasks || []);
    setIsLoading(false);
  };

  const handleEditTask = (task) => setEditingTask(task);

  const handleDeleteTask = async (task) => {
    const ok = await confirm({ description: `למחוק את "${task.title}"?` });
    if (ok) {
      try {
        await Task.delete(task.id);
        setTasks(prev => prev.filter(t => t.id !== task.id));
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleSaveTask = async (updatedData) => {
    try {
      await Task.update(editingTask.id, updatedData);
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updatedData } : t));
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const taskToUpdate = tasks.find(t => t.id === draggableId);
    if (!taskToUpdate) return;

    // Find the quadrant data from the destination
    const destinationQuadrant = quadrants.find(q => q.id === destination.droppableId);
    if (!destinationQuadrant) return;

    const { importance, priority } = destinationQuadrant;
    
    // Optimistic UI update
    const updatedTasks = tasks.map(t => {
      if (t.id === draggableId) {
        return { ...t, importance, priority };
      }
      return t;
    });
    setTasks(updatedTasks);
    
    // Update the backend
    await Task.update(draggableId, { importance, priority });
  };
  
  const quadrants = [
    { id: 'q1', title: 'עשה עכשיו', description: 'דחוף וחשוב', importance: 'high', priority: 'urgent', color: 'red' },
    { id: 'q2', title: 'תכנן', description: 'לא דחוף אבל חשוב', importance: 'high', priority: 'high', color: 'blue' },
    { id: 'q3', title: 'האצל סמכויות', description: 'דחוף אבל לא חשוב', importance: 'medium', priority: 'medium', color: 'orange' },
    { id: 'q4', title: 'מחק', description: 'לא דחוף ולא חשוב', importance: 'low', priority: 'low', color: 'gray' }
  ];
  
  const getQuadrantTasks = (importance, priority) => {
      if (priority === 'high') { // The "Plan" quadrant should also take medium priority
        return tasks.filter(t => t.importance === importance && (t.priority === 'high' || t.priority === 'medium'));
      }
      return tasks.filter(t => t.importance === importance && t.priority === priority);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen"
      >
        <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
                <Target className="w-10 h-10 text-blue-600"/>
                מטריצת ניהול משימות
            </h1>
            <p className="text-lg text-gray-600">גרור משימות בין הרבעונים כדי לתעדף אותן מחדш</p>
        </div>
        {isLoading ? (
          <div className="text-center text-lg">טוען משימות...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quadrants.map(q => (
              <DroppableQuadrant
                key={q.id}
                quadrant={q}
                tasks={getQuadrantTasks(q.importance, q.priority)}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </motion.div>
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
      {ConfirmDialogComponent}
    </DragDropContext>
  );
}