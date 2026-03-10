import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { differenceInDays, startOfDay } from 'date-fns';
import ProcessTaskItem from './ProcessTaskItem';
import { motion } from 'framer-motion';
import { Task } from '@/api/entities';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function ProcessStatusDashboard({ title, tasks, onTasksChange }) {
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [editingTask, setEditingTask] = useState(null);

  const handleEditTask = (task) => setEditingTask(task);

  const handleDeleteTask = async (task) => {
    const ok = await confirm({ description: `למחוק את "${task.title || task.client_name}"?` });
    if (ok) {
      try {
        await Task.delete(task.id);
        if (onTasksChange) onTasksChange();
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleSaveTask = async (updatedData) => {
    try {
      await Task.update(editingTask.id, updatedData);
      if (onTasksChange) onTasksChange();
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const urgentTasks = tasks.filter(t => {
    const daysLeft = t.due_date ? differenceInDays(startOfDay(new Date(t.due_date)), startOfDay(new Date())) : Infinity;
    return t.status !== 'completed' && daysLeft <= 3;
  }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date));

  const inProgressTasks = tasks.filter(t => t.status !== 'completed' && !urgentTasks.some(ut => ut.id === t.id));
  const doneTasks = tasks.filter(t => t.status === 'completed');

  const getRecommendation = () => {
    if (urgentTasks.length > 0) {
      return `💡 המלצה: התחל עם ${urgentTasks[0].client_name} - הכי דחוף!`;
    }
    if (inProgressTasks.length > 0) {
      return '👍 הכל בשליטה, המשך עבודה טובה!';
    }
    return '🎉 כל הכבוד! כל המשימות הושלמו.';
  };

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600">התקדמות</span>
            <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <motion.div
              className="bg-primary h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="space-y-4 flex-grow">
          {urgentTasks.length > 0 && (
            <div>
              <h4 className="font-semibold text-amber-600 mb-2">🔴 דחוף ({urgentTasks.length})</h4>
              <div className="space-y-2">
                {urgentTasks.map(task => <ProcessTaskItem key={task.id} task={task} onEdit={handleEditTask} onDelete={handleDeleteTask} />)}
              </div>
            </div>
          )}
          {inProgressTasks.length > 0 && (
            <div>
              <h4 className="font-semibold text-yellow-600 mb-2">🟡 בביצוע ({inProgressTasks.length})</h4>
              <div className="space-y-2">
                {inProgressTasks.map(task => <ProcessTaskItem key={task.id} task={task} onEdit={handleEditTask} onDelete={handleDeleteTask} />)}
              </div>
            </div>
          )}
          {doneTasks.length > 0 && (
            <div>
              <h4 className="font-semibold text-green-600 mb-2">🟢 הושלם ({doneTasks.length})</h4>
              <div className="space-y-2">
                {doneTasks.map(task => <ProcessTaskItem key={task.id} task={task} onEdit={handleEditTask} onDelete={handleDeleteTask} />)}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-sm text-center text-gray-700 font-medium">{getRecommendation()}</p>
        </div>
      </CardContent>
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
      {ConfirmDialogComponent}
    </Card>
  );
}