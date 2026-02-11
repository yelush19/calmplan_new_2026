import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Clock } from 'lucide-react';
import { parseISO, format, addHours, differenceInMinutes, isValid } from 'date-fns';
import { he } from 'date-fns/locale';

export default function EventTimelineModal({ event, tasks, onClose }) {
    const allItems = [
        { ...event, type: 'event' },
        ...tasks.map(t => ({ ...t, type: 'task' }))
    ];

    const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm
    const HOUR_HEIGHT_PX = 60;

    const getItemStyle = (item) => {
        const startDateStr = item.start_date || item.scheduled_start;
        if (!startDateStr) return { display: 'none' };
        
        try {
            const start = parseISO(startDateStr);
            if (!isValid(start) || start.getHours() < 6) return { display: 'none' };

            const end = item.end_date ? parseISO(item.end_date) : 
                        item.scheduled_end ? parseISO(item.scheduled_end) : 
                        addHours(start, item.estimated_minutes ? item.estimated_minutes / 60 : 1);
            
            const top = ((start.getHours() - 6) * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT_PX;
            const duration = Math.max(differenceInMinutes(end, start), 15);
            const height = (duration / 60) * HOUR_HEIGHT_PX;

            return {
                top: `${top}px`,
                height: `${height}px`,
            };
        } catch {
            return { display: 'none' };
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-lg"
            >
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>ציר זמן יומי</CardTitle>
                    <button onClick={onClose}><X /></button>
                </CardHeader>
                <CardContent className="max-h-[70vh] overflow-y-auto">
                    <div className="flex">
                        <div className="w-16 text-sm text-right pr-2">
                            {hours.map(hour => (
                                <div key={hour} style={{ height: `${HOUR_HEIGHT_PX}px` }} className="relative -top-2">
                                    {`${hour.toString().padStart(2, '0')}:00`}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 relative">
                            {hours.map(hour => (
                                <div key={hour} style={{ height: `${HOUR_HEIGHT_PX}px` }} className="border-t border-gray-200"></div>
                            ))}
                            {allItems.map(item => (
                                <div 
                                    key={item.id} 
                                    style={getItemStyle(item)}
                                    className={`absolute right-1 left-1 p-2 rounded-lg text-white text-xs overflow-hidden ${item.type === 'event' ? 'bg-blue-500' : 'bg-green-500'}`}
                                >
                                    <p className="font-bold">{item.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </motion.div>
        </motion.div>
    );
}