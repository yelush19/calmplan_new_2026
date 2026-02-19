import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Event, Task, DaySchedule } from '@/api/entities';
import { Bell, Clock, X, Check, MoreHorizontal, AlarmClockOff, MapPin, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO, subMinutes, isBefore, isAfter, addMinutes, isValid } from 'date-fns';

export default function ReminderSystem() {
  const [activeReminders, setActiveReminders] = useState([]);
  const [snoozedReminders, setSnoozedReminders] = useState([]);

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const now = new Date();
        const [events, tasks] = await Promise.all([
            Event.list(),
            Task.list()
        ]);

        const upcoming = [];

        (events || []).forEach(event => {
          if (!event.start_date || !isValid(parseISO(event.start_date))) return;
          const eventTime = parseISO(event.start_date);
          const reminderTime = subMinutes(eventTime, event.reminder_minutes || 15);
          
          if (isAfter(now, reminderTime) && isBefore(now, eventTime)) {
            const reminderId = `event-${event.id}`;
            if (!snoozedReminders.includes(reminderId)) {
              upcoming.push({ 
                id: reminderId, 
                title: event.title, 
                time: event.start_date, 
                type: 'אירוע',
                priority: event.priority,
                location: event.location,
                hasTravel: event.location && !event.location.toLowerCase().includes('zoom') && !event.location.toLowerCase().includes('meet')
              });
            }
          }

          if (event.location && 
              !event.location.toLowerCase().includes('zoom') && 
              !event.location.toLowerCase().includes('meet') &&
              !event.location.toLowerCase().includes('teams')) {
            
            const travelReminderTime = subMinutes(eventTime, 60);
            if (isAfter(now, travelReminderTime) && isBefore(now, eventTime)) {
              const travelReminderId = `travel-${event.id}`;
              if (!snoozedReminders.includes(travelReminderId)) {
                upcoming.push({
                  id: travelReminderId,
                  title: `הכנה לנסיעה: ${event.title}`,
                  time: event.start_date,
                  type: 'נסיעה',
                  priority: 'high',
                  location: event.location,
                  isTravel: true,
                  originalEvent: event
                });
              }
            }
          }
        });
        
        (tasks || []).forEach(task => {
            if (!task.scheduled_start || task.status === 'completed' || !isValid(parseISO(task.scheduled_start))) return;
            const taskTime = parseISO(task.scheduled_start);
            const reminderTime = subMinutes(taskTime, 15);
            if (isAfter(now, reminderTime) && isBefore(now, taskTime)) {
              const reminderId = `task-${task.id}`;
              if (!snoozedReminders.includes(reminderId)) {
                upcoming.push({ 
                  id: reminderId, 
                  title: task.title, 
                  time: task.scheduled_start, 
                  type: 'משימה',
                  priority: task.priority 
                });
              }
            }
        });

        const lastSummary = localStorage.getItem('lastSummaryTime');
        const lastSummaryTime = lastSummary ? new Date(lastSummary) : new Date(0);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        
        if (lastSummaryTime < threeHoursAgo) {
          const urgentTasks = (tasks || []).filter(task => 
            task.status !== 'completed' && 
            (task.priority === 'urgent' || task.priority === 'high')
          ).length;
          
          const completedToday = (tasks || []).filter(task => 
            task.completed_date && isValid(parseISO(task.completed_date)) &&
            new Date(task.completed_date).toDateString() === now.toDateString()
          ).length;

          const todayEventsWithTravel = (events || []).filter(event => {
            if (!event.start_date || !event.location || !isValid(parseISO(event.start_date))) return false;
            const eventDate = parseISO(event.start_date);
            return eventDate.toDateString() === now.toDateString() && 
                   !event.location.toLowerCase().includes('zoom') &&
                   !event.location.toLowerCase().includes('meet');
          }).length;

          if (!snoozedReminders.includes('summary-reminder')) {
            upcoming.push({
              id: 'summary-reminder',
              title: `סיכום: ${completedToday} בוצעו, ${urgentTasks} דחופות נותרו${todayEventsWithTravel > 0 ? `, ${todayEventsWithTravel} פגישות עם נסיעה` : ''}`,
              time: now.toISOString(),
              type: 'סיכום',
              priority: 'medium',
              isSummary: true,
              travelCount: todayEventsWithTravel
            });
          }
        }
        
        setActiveReminders(upcoming);

      } catch (error) {
        console.error("Error checking reminders:", error);
      }
    };

    const intervalId = setInterval(checkReminders, 60000);
    checkReminders();

    return () => clearInterval(intervalId);
  }, [snoozedReminders]);

  const dismissReminder = (id) => {
    setActiveReminders(prev => prev.filter(r => r.id !== id));
    if (id === 'summary-reminder') {
      localStorage.setItem('lastSummaryTime', new Date().toISOString());
    }
  };

  const snoozeReminder = (id, minutes = 15) => {
    setSnoozedReminders(prev => [...prev, id]);
    setActiveReminders(prev => prev.filter(r => r.id !== id));
    
    setTimeout(() => {
      setSnoozedReminders(prev => prev.filter(snoozedId => snoozedId !== id));
    }, minutes * 60 * 1000);
  };

  return (
    <div className="fixed bottom-0 right-0 p-4 space-y-4 z-[100] pointer-events-none">
      <AnimatePresence>
        {activeReminders.map(reminder => (
          <motion.div
            key={reminder.id}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            layout
            className="w-96 bg-white rounded-2xl shadow-2xl border-2 border-gray-200 pointer-events-auto"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  reminder.isTravel ? 'bg-orange-500' :
                  reminder.priority === 'urgent' ? 'bg-amber-500' :
                  reminder.priority === 'high' ? 'bg-orange-500' :
                  'bg-blue-500'
                } text-white`}>
                  {reminder.isTravel ? <Car className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {reminder.type}
                    </span>
                    {reminder.priority === 'urgent' && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold animate-pulse">
                        דחוף!
                      </span>
                    )}
                    {reminder.isTravel && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-bold">
                        🚗 נסיעה
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{reminder.title}</h4>
                  {!reminder.isSummary && (
                    <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isValid(parseISO(reminder.time)) ? format(parseISO(reminder.time), 'HH:mm') : ''}
                    </p>
                  )}
                  {reminder.location && (
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      📍 {reminder.location}
                    </p>
                  )}
                  {reminder.isTravel && (
                    <div className="mt-2 p-2 bg-orange-50 rounded text-sm text-orange-700">
                      💡 הגיע הזמן לתכנן את הדרך ולצאת לפגישה
                    </div>
                  )}
                  {reminder.isSummary && reminder.travelCount > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                      🚗 זכור: יש לך היום {reminder.travelCount} פגישות עם נסיעה
                    </div>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => dismissReminder(reminder.id)} 
                  className="text-gray-400 hover:bg-gray-100 rounded-full"
                >
                    <X className="w-4 h-4"/>
                </Button>
              </div>
              <div className="mt-6 flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => dismissReminder(reminder.id)} 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  <Check className="w-4 h-4 ml-1" />
                  הבנתי
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => snoozeReminder(reminder.id, 15)}
                  className="px-3"
                >
                  <AlarmClockOff className="w-4 h-4 ml-1" />
                  15 דק׳
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => snoozeReminder(reminder.id, 60)}
                  className="px-3"
                >
                  שעה
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}