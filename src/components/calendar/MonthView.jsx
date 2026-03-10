import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function MonthView({ currentDate, items = [], onItemClick, onDayClick, categoryColors = {} }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the week (0 for Sunday, 1 for Monday...)
  const firstDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: firstDayOfWeek });

  const getItemsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return items.filter(item => {
      if (!item) return false;
      
      // For events, check start_date
      if (item.itemType === 'event' && item.start_date) {
        const eventDateStr = item.start_date.split('T')[0]; // Get YYYY-MM-DD part
        return eventDateStr === dateStr;
      }
      
      // For tasks, check due_date or scheduled_start
      if (item.itemType === 'task') {
        const taskDateStr = item.due_date || (item.scheduled_start && item.scheduled_start.split('T')[0]);
        return taskDateStr === dateStr;
      }
      
      return false;
    });
  };

  const getItemColor = (item) => {
    // Updated colors - better contrast
    const typeColors = {
      task: 'bg-blue-100 text-blue-800 border-blue-200',
      event: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    // Special category overrides with better contrast
    const categoryOverrides = {
      health: 'bg-green-100 text-green-800 border-green-200',     // Treatments - GREEN
      meeting: 'bg-orange-100 text-orange-800 border-orange-200' // Meetings - ORANGE (not teal)
    };

    return categoryOverrides[item.category] || typeColors[item.itemType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getTimeDisplay = (item) => {
    if (item.itemType === 'event' && item.start_date && item.end_date) {
      const startTime = item.start_date.split('T')[1]?.substring(0, 5); // Get HH:MM
      const endTime = item.end_date.split('T')[1]?.substring(0, 5);
      return startTime && endTime ? `${startTime}-${endTime}` : '';
    }
    return '';
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-1 mb-2 text-center text-sm font-semibold text-gray-500">
        {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day) => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {/* Padding days */}
        {paddingDays.map((_, index) => (
          <div key={`pad-${index}`} className="min-h-32 border rounded-lg bg-gray-50"></div>
        ))}

        {/* Month days */}
        {monthDays.map((day) => {
          const dayItems = getItemsForDate(day);
          const isCurrentDay = isToday(day);
          
          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => onDayClick && onDayClick(day)}
              className={`
                min-h-32 p-2 border rounded-lg flex flex-col gap-1 cursor-pointer transition-colors duration-200
                ${isCurrentDay ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300' : 'bg-white hover:bg-gray-50 border-gray-200'}
              `}
            >
              <span className={`font-bold self-start text-sm ${isCurrentDay ? 'text-blue-600' : 'text-gray-700'}`}>
                {format(day, 'd')}
              </span>
              
              <div className="flex-grow space-y-1">
                {dayItems.slice(0, 3).map((item) => {
                  const timeDisplay = getTimeDisplay(item);
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onItemClick) onItemClick(item);
                      }}
                      className={`text-xs p-1.5 rounded-md cursor-pointer font-medium border ${getItemColor(item)} hover:opacity-80 transition-opacity`}
                      title={`${item.title}${timeDisplay ? ` (${timeDisplay})` : ''}`}
                    >
                      <div className="font-semibold truncate">{item.title}</div>
                      {timeDisplay && (
                        <div className="text-xs opacity-75">{timeDisplay}</div>
                      )}
                    </div>
                  );
                })}
                
                {dayItems.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium text-center pt-1">
                    +{dayItems.length - 3} נוספים
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}