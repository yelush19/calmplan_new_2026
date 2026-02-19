import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, Calendar, Plus, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Task, Dashboard } from '@/api/entities';
import { format, startOfWeek, addDays, parseISO, isValid, startOfDay } from 'date-fns';

const DAYS = [
  { id: 'sunday', name: 'ראשון' },
  { id: 'monday', name: 'שני' },
  { id: 'tuesday', name: 'שלישי' },
  { id: 'wednesday', name: 'רביעי' },
  { id: 'thursday', name: 'חמישי' },
];

const HOURS = Array.from({ length: 11 }, (_, i) => {
  const hour = 8 + i;
  return {
    id: hour,
    display: `${hour.toString().padStart(2, '0')}:00`,
    value: hour
  };
});

const TASK_COLORS = {
  work: 'bg-blue-100 border-blue-300 text-blue-800',
  family: 'bg-green-100 border-green-300 text-green-800',
  personal: 'bg-gray-100 border-gray-300 text-gray-800'
};

export default function WeeklyPlanner() {
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      const todayStart = startOfDay(today);

      // Load board configs to categorize tasks
      const boardConfigs = await Dashboard.list() || [];
      const workBoardTypes = ['reports', 'reconciliations', 'client_accounts', 'payroll', 'clients',
        'reports_main', 'reports_126_856_2025', 'reports_126_856_2024', 'weekly_tasks', 'balance_sheets'];
      const homeBoardTypes = ['family_tasks', 'wellbeing'];

      const workBoardIds = boardConfigs
        .filter(c => workBoardTypes.includes(c.type) && c.monday_board_id)
        .map(c => c.monday_board_id);
      const homeBoardIds = boardConfigs
        .filter(c => homeBoardTypes.includes(c.type) && c.monday_board_id)
        .map(c => c.monday_board_id);

      const allTasks = await Task.list(null, 5000).catch(() => []);

      // Get tasks that are open and relevant for this week (or overdue)
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const relevantTasks = (allTasks || []).filter(t => {
        if (t.status === 'completed') return false;
        const dateStr = t.due_date || t.scheduled_start;
        if (!dateStr) return true; // Tasks without dates are available to schedule
        // Include tasks due this week or overdue
        return dateStr <= weekEndStr;
      }).map(t => {
        let type = 'work';
        if (t.monday_board_id && homeBoardIds.includes(t.monday_board_id)) {
          type = 'family';
        }
        return {
          id: t.id,
          title: t.title || t.name || 'משימה',
          duration: 1,
          type,
          due_date: t.due_date || t.scheduled_start,
          isOverdue: t.due_date && t.due_date < format(todayStart, 'yyyy-MM-dd'),
          original: t
        };
      });

      setAvailableTasks(relevantTasks);
    } catch (error) {
      console.error('Error loading tasks for planner:', error);
    }
    setIsLoading(false);
  };

  const filteredTasks = availableTasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksForCell = (dayId, hour) => {
    return scheduledTasks.filter(task =>
      task.day === dayId &&
      task.startHour <= hour &&
      task.endHour > hour
    );
  };

  const onDragEnd = (result) => {
    const { destination } = result;

    if (!destination) return;

    const [dayId, hourStr] = destination.droppableId.split('-');
    const hour = parseInt(hourStr);

    const taskId = result.draggableId;
    const task = availableTasks.find(t => t.id === taskId);

    if (!task) return;

    const scheduledTask = {
      ...task,
      day: dayId,
      startHour: hour,
      endHour: hour + task.duration,
      scheduledId: `scheduled-${Date.now()}`
    };

    setScheduledTasks(prev => [...prev, scheduledTask]);
  };

  const removeScheduledTask = (scheduledId) => {
    setScheduledTasks(prev => prev.filter(task => task.scheduledId !== scheduledId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Calendar className="w-10 h-10 animate-pulse text-primary mx-auto mb-3" />
          <p className="text-gray-600">טוען משימות לתכנון...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            תכנון שבועי
          </h1>
          <p className="text-gray-600">
            גרור משימות לתוך הלוח כדי לתכנן את השבוע שלך
          </p>
        </div>
        <Button variant="outline" onClick={loadTasks} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          רענן
        </Button>
      </motion.div>

      {availableTasks.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800">
              אין משימות פתוחות לתכנון. סנכרן משימות מ-Monday.com או צור משימות חדשות.
            </p>
          </CardContent>
        </Card>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6">
          {/* רשימת משימות זמינות */}
          <Card className="w-80 flex-shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                משימות למיקום ({filteredTasks.length})
              </CardTitle>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="חפש משימה..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              <Droppable droppableId="available-tasks">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {filteredTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-3 rounded-lg border-2 border-dashed cursor-grab mb-2 transition-all duration-200 ${
                              snapshot.isDragging
                                ? 'shadow-lg scale-105 rotate-2'
                                : 'hover:shadow-md'
                            } ${TASK_COLORS[task.type] || TASK_COLORS.work}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{task.title}</h4>
                                {task.due_date && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    <span className={`text-xs ${task.isOverdue ? 'text-amber-600 font-bold' : ''}`}>
                                      {task.due_date}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {task.type === 'work' && 'עבודה'}
                                {task.type === 'family' && 'בית'}
                                {task.type === 'personal' && 'אישי'}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* גריד שבועי */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                תכנון השבוע
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-6 gap-1 min-w-[800px]">
                  <div className="p-2 font-semibold text-center text-gray-600">
                    שעה
                  </div>

                  {DAYS.map(day => (
                    <div
                      key={day.id}
                      className="p-2 font-semibold text-center rounded-t-lg bg-gray-100 text-gray-700"
                    >
                      {day.name}
                    </div>
                  ))}

                  {HOURS.map(hour => (
                    <React.Fragment key={hour.id}>
                      <div className="p-2 text-center text-sm text-gray-500 border-r border-gray-200">
                        {hour.display}
                      </div>

                      {DAYS.map(day => {
                        const cellTasks = getTasksForCell(day.id, hour.value);
                        const cellId = `${day.id}-${hour.value}`;

                        return (
                          <Droppable key={cellId} droppableId={cellId}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[60px] p-1 border border-gray-200 transition-colors duration-200 bg-white ${
                                  snapshot.isDraggingOver ? 'bg-blue-100 border-blue-300' : ''
                                }`}
                              >
                                {cellTasks.map(task => (
                                  <div
                                    key={task.scheduledId}
                                    className={`p-1 rounded text-xs mb-1 cursor-pointer hover:shadow-md transition-shadow ${TASK_COLORS[task.type] || TASK_COLORS.work}`}
                                    onClick={() => removeScheduledTask(task.scheduledId)}
                                    title={`לחץ להסרה: ${task.title}`}
                                  >
                                    {task.title}
                                  </div>
                                ))}

                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DragDropContext>

      {/* מקרא צבעים */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">מקרא צבעים:</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded border border-blue-300"></div>
              <span className="text-sm">עבודה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded border border-green-300"></div>
              <span className="text-sm">בית ומשפחה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300"></div>
              <span className="text-sm">אישי</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
