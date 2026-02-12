import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task, Client } from '@/api/entities';
import {
  Bell, AlertTriangle, Clock, X, Check, ChevronDown, ChevronUp,
  Calendar, User, AlertOctagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  format, parseISO, differenceInDays, isValid, startOfDay, isPast,
  addDays, isToday, isTomorrow
} from 'date-fns';
import { he } from 'date-fns/locale';

const REMINDER_THRESHOLDS = [7, 3, 1, 0];
const DISMISSED_KEY = 'calmplan_dismissed_reminders';
const LAST_CHECK_KEY = 'calmplan_last_reminder_check';

function getDismissedToday() {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return {};
    const data = JSON.parse(stored);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (data.date !== today) {
      localStorage.removeItem(DISMISSED_KEY);
      return {};
    }
    return data.dismissed || {};
  } catch {
    return {};
  }
}

function dismissForToday(taskId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const current = getDismissedToday();
  current[taskId] = true;
  localStorage.setItem(DISMISSED_KEY, JSON.stringify({ date: today, dismissed: current }));
}

function getUrgencyLevel(daysUntilDue) {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue <= 1) return 'tomorrow';
  if (daysUntilDue <= 3) return 'soon';
  if (daysUntilDue <= 7) return 'upcoming';
  return 'safe';
}

function getUrgencyConfig(level) {
  const configs = {
    overdue: {
      bg: 'bg-red-600',
      bgLight: 'bg-red-50 border-red-300',
      text: 'text-red-900',
      textLight: 'text-red-700',
      badge: 'bg-red-600 text-white',
      icon: AlertOctagon,
      pulse: true,
      label: 'באיחור!'
    },
    today: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      textLight: 'text-red-600',
      badge: 'bg-red-500 text-white',
      icon: AlertTriangle,
      pulse: true,
      label: 'היום!'
    },
    tomorrow: {
      bg: 'bg-orange-500',
      bgLight: 'bg-orange-50 border-orange-200',
      text: 'text-orange-800',
      textLight: 'text-orange-600',
      badge: 'bg-orange-500 text-white',
      icon: Clock,
      pulse: false,
      label: 'מחר'
    },
    soon: {
      bg: 'bg-yellow-500',
      bgLight: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      textLight: 'text-yellow-600',
      badge: 'bg-yellow-500 text-white',
      icon: Bell,
      pulse: false,
      label: 'בקרוב'
    },
    upcoming: {
      bg: 'bg-blue-400',
      bgLight: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      textLight: 'text-blue-600',
      badge: 'bg-blue-400 text-white',
      icon: Calendar,
      pulse: false,
      label: 'השבוע'
    },
    safe: {
      bg: 'bg-green-400',
      bgLight: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      textLight: 'text-green-600',
      badge: 'bg-green-400 text-white',
      icon: Check,
      pulse: false,
      label: 'בסדר'
    }
  };
  return configs[level] || configs.safe;
}

export default function AggressiveReminderSystem({ onTaskCount }) {
  const [reminders, setReminders] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(getDismissedToday());

  const loadReminders = useCallback(async () => {
    try {
      const [tasks, clients] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 500).catch(() => [])
      ]);

      const clientMap = {};
      (clients || []).forEach(c => {
        clientMap[c.id] = c.name;
        if (c.monday_id) clientMap[c.monday_id] = c.name;
      });

      const today = startOfDay(new Date());
      const reminderList = [];

      const MAX_OVERDUE_DAYS = 180;
      (tasks || []).forEach(task => {
        if (task.status === 'completed') return;

        const dueDateStr = task.due_date || task.scheduled_start;
        if (!dueDateStr) return;

        let dueDate;
        try {
          dueDate = parseISO(dueDateStr);
          if (!isValid(dueDate)) return;
        } catch {
          return;
        }

        const daysUntilDue = differenceInDays(startOfDay(dueDate), today);

        // Skip tasks overdue by more than 180 days (stale/abandoned)
        if (daysUntilDue < -MAX_OVERDUE_DAYS) return;

        const urgency = getUrgencyLevel(daysUntilDue);

        if (urgency === 'overdue' || REMINDER_THRESHOLDS.some(t => daysUntilDue <= t)) {
          const clientName = task.client_name ||
            (task.client_id && clientMap[task.client_id]) || '';

          reminderList.push({
            id: task.id,
            title: task.title,
            clientName,
            dueDate: dueDateStr,
            daysUntilDue,
            urgency,
            priority: task.priority,
            status: task.status,
            category: task.category
          });
        }
      });

      reminderList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

      setReminders(reminderList);
      if (onTaskCount) {
        const overdueCount = reminderList.filter(r => r.urgency === 'overdue').length;
        const todayCount = reminderList.filter(r => r.urgency === 'today').length;
        onTaskCount({ overdue: overdueCount, today: todayCount, total: reminderList.length });
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  }, [onTaskCount]);

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadReminders]);

  const handleDismiss = (taskId) => {
    dismissForToday(taskId);
    setDismissed(prev => ({ ...prev, [taskId]: true }));
  };

  const visibleReminders = reminders.filter(r => {
    if (r.urgency === 'overdue') return true;
    return !dismissed[r.id];
  });

  const overdueReminders = visibleReminders.filter(r => r.urgency === 'overdue');
  const todayReminders = visibleReminders.filter(r => r.urgency === 'today');
  const soonReminders = visibleReminders.filter(r => r.urgency === 'tomorrow' || r.urgency === 'soon');
  const upcomingReminders = visibleReminders.filter(r => r.urgency === 'upcoming');

  if (visibleReminders.length === 0) return null;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-4 left-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className={`rounded-full w-14 h-14 shadow-xl ${
            overdueReminders.length > 0 ? 'bg-red-600 hover:bg-red-700 animate-pulse' :
            todayReminders.length > 0 ? 'bg-red-500 hover:bg-red-600' :
            'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          <div className="relative">
            <Bell className="w-6 h-6 text-white" />
            <span className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
              {visibleReminders.length}
            </span>
          </div>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 space-y-3"
    >
      {/* Overdue - Always visible, can't fully dismiss */}
      {overdueReminders.length > 0 && (
        <Card className="border-2 border-red-400 bg-red-50 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                  <AlertOctagon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-red-900 text-lg">
                    {overdueReminders.length} משימות באיחור!
                  </h3>
                  <p className="text-sm text-red-700">חובה לטפל - לא ייעלם עד שיסומן</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {overdueReminders.map(reminder => (
                <ReminderItem key={reminder.id} reminder={reminder} canDismiss={false} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's deadlines */}
      {todayReminders.length > 0 && (
        <Card className="border-2 border-red-300 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-red-800">
                {todayReminders.length} משימות ליום - מגיעות היום!
              </h3>
            </div>
            <div className="space-y-2">
              {todayReminders.map(reminder => (
                <ReminderItem
                  key={reminder.id}
                  reminder={reminder}
                  canDismiss={true}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coming soon (1-3 days) */}
      {soonReminders.length > 0 && (
        <Card className="border border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-orange-800">
                  {soonReminders.length} משימות ב-3 ימים הקרובים
                </h3>
              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-orange-600" /> : <ChevronDown className="w-5 h-5 text-orange-600" />}
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 mt-3"
                >
                  {soonReminders.map(reminder => (
                    <ReminderItem
                      key={reminder.id}
                      reminder={reminder}
                      canDismiss={true}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Upcoming (4-7 days) */}
      {upcomingReminders.length > 0 && (
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">
                {upcomingReminders.length} משימות ב-7 ימים הקרובים
              </span>
              <div className="flex flex-wrap gap-1 mr-2">
                {upcomingReminders.slice(0, 3).map(r => (
                  <Badge key={r.id} variant="outline" className="text-xs border-blue-300 text-blue-700">
                    {r.title.slice(0, 20)}{r.title.length > 20 ? '...' : ''}
                  </Badge>
                ))}
                {upcomingReminders.length > 3 && (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                    +{upcomingReminders.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function ReminderItem({ reminder, canDismiss, onDismiss }) {
  const config = getUrgencyConfig(reminder.urgency);
  const IconComponent = config.icon;

  const formatDueText = () => {
    if (reminder.daysUntilDue < 0) {
      const days = Math.abs(reminder.daysUntilDue);
      return `איחור של ${days} ${days === 1 ? 'יום' : 'ימים'}`;
    }
    if (reminder.daysUntilDue === 0) return 'מגיע היום';
    if (reminder.daysUntilDue === 1) return 'מגיע מחר';
    return `עוד ${reminder.daysUntilDue} ימים`;
  };

  const formatDateDisplay = () => {
    try {
      const date = parseISO(reminder.dueDate);
      if (!isValid(date)) return '';
      return format(date, 'dd/MM/yyyy (EEEE)', { locale: he });
    } catch {
      return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-3 rounded-lg border ${config.bgLight} ${config.pulse ? 'animate-pulse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        <IconComponent className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold ${config.text} truncate`}>{reminder.title}</span>
          <Badge className={`text-xs ${config.badge}`}>{formatDueText()}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs">
          {reminder.clientName && (
            <span className={`flex items-center gap-1 ${config.textLight}`}>
              <User className="w-3 h-3" />
              {reminder.clientName}
            </span>
          )}
          <span className={config.textLight}>
            {formatDateDisplay()}
          </span>
        </div>
      </div>

      {canDismiss && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(reminder.id)}
          className={`flex-shrink-0 ${config.textLight} hover:bg-white/50`}
          title="הסתר להיום"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </motion.div>
  );
}
