import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'framer-motion';

const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export default function DayView({ selectedDate, items = [], onEventClick, categoryColors = {}, priorityColors = {} }) {
    const dayItems = (Array.isArray(items) ? items : []).filter(item => {
        const itemDateStr = (item.start_date || item.scheduled_start)?.split('T')[0];
        return itemDateStr === format(selectedDate, 'yyyy-MM-dd');
    });

    const getEventPositionAndHeight = (item) => {
        if (!item.start_date) return { top: 0, height: 0 };
        const start = new Date(item.start_date);
        const end = item.end_date ? new Date(item.end_date) : new Date(start.getTime() + 60 * 60 * 1000);

        const top = (start.getHours() + start.getMinutes() / 60) * 60; // position in pixels
        const height = Math.max(30, ((end - start) / (1000 * 60)) * 1); // height in pixels, min 30px
        
        return { top, height };
    };

    return (
        <div className="flex">
            <div className="w-16 text-center text-sm text-gray-500">
                {hours.map(hour => (
                    <div key={hour} className="h-[60px] relative -top-3 pt-3 border-r pr-2">
                        {hour}
                    </div>
                ))}
            </div>
            <div className="flex-1 relative border-t">
                {hours.map(hour => (
                    <div key={`line-${hour}`} className="h-[60px] border-b border-gray-100"></div>
                ))}

                {dayItems.map((item, index) => {
                    const { top, height } = getEventPositionAndHeight(item);
                    const colorClasses = categoryColors[item.category] || categoryColors.event;
                    const priorityClass = priorityColors[item.priority] || '';
                    
                    return (
                        <motion.div
                            key={item.id || index}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`absolute right-2 left-2 p-2 rounded-lg cursor-pointer ${colorClasses} ${priorityClass}`}
                            style={{ top: `${top}px`, height: `${height}px` }}
                            onClick={() => onEventClick(item)}
                        >
                            <p className="font-bold text-sm truncate">{item.title}</p>
                            <p className="text-xs opacity-80 truncate">{item.description}</p>
                            <p className="text-xs opacity-70 mt-1">{format(new Date(item.start_date), 'HH:mm')}</p>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}