import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Clock, Calendar, Plus, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const DAYS = [
  { id: 'sunday', name: 'ראשון', isSpecial: false },
  { id: 'monday', name: 'שני', isSpecial: false },
  { id: 'tuesday', name: 'שלישי', isSpecial: false },
  { id: 'wednesday', name: 'רביעי', isSpecial: false },
  { id: 'thursday', name: 'חמישי', isSpecial: true }, // יום טיפולים
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
  treatment: 'bg-red-100 border-red-300 text-red-800',
  work: 'bg-blue-100 border-blue-300 text-blue-800', 
  family: 'bg-green-100 border-green-300 text-green-800',
  personal: 'bg-gray-100 border-gray-300 text-gray-800'
};

const FIXED_BLOCKS = [
  // טיפולים קבועים לדוגמה - יום חמישי
  {
    id: 'treatment-1',
    day: 'thursday',
    startHour: 9,
    endHour: 11,
    title: 'טיפול פיזיותרפיה',
    type: 'treatment',
    isFixed: true,
    location: 'מרכז רפואי'
  },
  {
    id: 'treatment-2', 
    day: 'thursday',
    startHour: 14,
    endHour: 15,
    title: 'בדיקה רפואית',
    type: 'treatment',
    isFixed: true,
    location: 'קופת חולים'
  }
];

export default function WeeklyPlanner() {
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([
    {
      id: 'task-1',
      title: 'הכנת ארוחת ערב',
      duration: 2,
      type: 'family',
      category: 'home_food_planning'
    },
    {
      id: 'task-2', 
      title: 'ניקיון מטבח',
      duration: 1,
      type: 'family',
      category: 'home_cleaning_kitchen'
    },
    {
      id: 'task-3',
      title: 'דיווח מע"מ - לקוח א',
      duration: 3,
      type: 'work',
      category: 'work_vat_reporting'
    },
    {
      id: 'task-4',
      title: 'זמן אישי - קריאה',
      duration: 1,
      type: 'personal',
      category: 'home_personal_time'
    }
  ]);
  const [searchTerm, setSearchTerm] = useState('');

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

  const getFixedBlocksForCell = (dayId, hour) => {
    return FIXED_BLOCKS.filter(block =>
      block.day === dayId &&
      block.startHour <= hour &&
      block.endHour > hour
    );
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    
    if (!destination) return;

    // Extract day and hour from destination droppableId
    const [dayId, hourStr] = destination.droppableId.split('-');
    const hour = parseInt(hourStr);

    // Get the task being moved
    const taskId = result.draggableId;
    const task = availableTasks.find(t => t.id === taskId);
    
    if (!task) return;

    // Check if there's a conflict with fixed blocks
    const hasFixedBlockConflict = FIXED_BLOCKS.some(block =>
      block.day === dayId &&
      ((hour >= block.startHour && hour < block.endHour) ||
       (hour + task.duration > block.startHour && hour < block.endHour))
    );

    if (hasFixedBlockConflict) {
      alert('לא ניתן לתזמן משימה על גבי בלוק קבוע');
      return;
    }

    // Create scheduled task
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

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          תכנון שבועי חכם
        </h1>
        <p className="text-gray-600">
          גרור משימות לתוך הלוח כדי לתכנן את השבוע שלך
        </p>
      </motion.div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6">
          {/* רשימת משימות זמינות */}
          <Card className="w-80 flex-shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                משימות למיקום
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
            <CardContent className="space-y-2">
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
                            } ${TASK_COLORS[task.type]}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{task.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs">{task.duration} שעות</span>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {task.type === 'treatment' && 'טיפול'}
                                {task.type === 'work' && 'עבודה'}
                                {task.type === 'family' && 'משפחה'}
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
                  {/* כותרת - שעות */}
                  <div className="p-2 font-semibold text-center text-gray-600">
                    שעה
                  </div>
                  
                  {/* כותרות ימים */}
                  {DAYS.map(day => (
                    <div
                      key={day.id}
                      className={`p-2 font-semibold text-center rounded-t-lg ${
                        day.isSpecial 
                          ? 'bg-red-100 text-red-800 border-2 border-red-300' 
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day.name}
                      {day.isSpecial && (
                        <div className="text-xs font-normal mt-1">יום טיפולים</div>
                      )}
                    </div>
                  ))}

                  {/* תאי הגריד */}
                  {HOURS.map(hour => (
                    <React.Fragment key={hour.id}>
                      {/* עמודת השעות */}
                      <div className="p-2 text-center text-sm text-gray-500 border-r border-gray-200">
                        {hour.display}
                      </div>
                      
                      {/* תאים לכל יום */}
                      {DAYS.map(day => {
                        const fixedBlocks = getFixedBlocksForCell(day.id, hour.value);
                        const scheduledTasks = getTasksForCell(day.id, hour.value);
                        const cellId = `${day.id}-${hour.value}`;
                        
                        return (
                          <Droppable key={cellId} droppableId={cellId}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[60px] p-1 border border-gray-200 transition-colors duration-200 ${
                                  day.isSpecial ? 'bg-red-50' : 'bg-white'
                                } ${
                                  snapshot.isDragginOver ? 'bg-blue-100 border-blue-300' : ''
                                } ${
                                  fixedBlocks.length > 0 ? 'bg-red-200 cursor-not-allowed' : ''
                                }`}
                              >
                                {/* בלוקים קבועים */}
                                {fixedBlocks.map(block => (
                                  <div
                                    key={block.id}
                                    className="bg-red-300 text-red-900 p-1 rounded text-xs font-semibold mb-1 shadow-sm"
                                    title={`${block.title} - ${block.location}`}
                                  >
                                    {block.title}
                                  </div>
                                ))}
                                
                                {/* משימות מתוזמנות */}
                                {scheduledTasks.map(task => (
                                  <div
                                    key={task.scheduledId}
                                    className={`p-1 rounded text-xs mb-1 cursor-pointer hover:shadow-md transition-shadow ${TASK_COLORS[task.type]}`}
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
              <div className="w-4 h-4 bg-red-200 rounded border border-red-300"></div>
              <span className="text-sm">טיפולים (קבוע)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded border border-blue-300"></div>
              <span className="text-sm">עבודה</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded border border-green-300"></div>
              <span className="text-sm">משפחה</span>
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