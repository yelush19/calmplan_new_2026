import React from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function WeekView({ currentDate, items = [], onEventClick, categoryColors = {}, priorityColors = {} }) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const getItemsForDate = (date) => {
        return (Array.isArray(items) ? items : []).filter(item => {
            const itemDateStr = (item.start_date || item.due_date || item.scheduled_start)?.split('T')[0];
            return itemDateStr === format(date, 'yyyy-MM-dd');
        }).sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
    };

    return (
        <div className="grid grid-cols-7 divide-x divide-gray-200">
            {weekDays.map((day, dayIndex) => (
                <div key={day.toISOString()} className="flex flex-col">
                    <div className={`text-center py-3 border-b ${isToday(day) ? 'bg-primary/10 text-primary font-bold' : 'bg-gray-50'}`}>
                        <p className="text-sm">{format(day, 'EEE', { locale: he })}</p>
                        <p className="text-lg">{format(day, 'd')}</p>
                    </div>
                    <div className="flex-grow p-2 space-y-2 min-h-[600px] bg-white">
                        {getItemsForDate(day).map((item, itemIndex) => {
                            const colorClasses = categoryColors[item.category] || categoryColors.event;
                            const priorityClass = priorityColors[item.priority] || '';
                            
                            return (
                                <motion.div
                                    key={item.id || itemIndex}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: itemIndex * 0.05 }}
                                    onClick={() => onEventClick(item)}
                                    className={`p-2 rounded-lg cursor-pointer text-xs ${colorClasses} ${priorityClass}`}
                                >
                                    <p className="font-bold truncate">{item.title}</p>
                                    {item.start_date && <p className="opacity-80">{format(new Date(item.start_date), 'HH:mm')}</p>}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}