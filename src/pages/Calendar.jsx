
import React, { useState, useEffect } from "react";
import { Event, Task, Dashboard } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle }
  from "@/components/ui/card";
import { Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, parseISO, isValid, isBefore, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

import CalendarHeader from "../components/calendar/CalendarHeader";
import MonthView from "../components/calendar/MonthView";
import WeekView from "../components/calendar/WeekView";
import DayView from "../components/calendar/DayView";
import EventCard from "../components/calendar/EventCard";
import EventDetailsModal from "../components/calendar/EventDetailsModal";

// Helper function to safely parse dates
const safeParseDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Invalid date string:', dateString);
    return null;
  }
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date()); // Corrected line
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. קריאת הגדרות הלוחות - בדיוק כמו ב-Tasks
      const boardConfigs = await Dashboard.list() || [];
      
      // 2. איסוף כל ה-board IDs (גם work וגם home)
      const allBoardIds = boardConfigs
        .filter(config => config.monday_board_id)
        .map(config => config.monday_board_id);
      
      if (allBoardIds.length === 0) {
        setTasks([]);
        setEvents([]);
        setIsLoading(false);
        return;
      }
      
      // 3. קריאת המשימות והאירועים
      const [tasksData, eventsData] = await Promise.all([
        Task.filter({
          'monday_sync.board_id': { '$in': allBoardIds },
          status: { $ne: "completed" }  // לא להביא משימות שהושלמו
        }, "-created_date", 2000).catch(() => []),
        Event.list("-start_date", 1000).catch(() => []),
      ]);

      const fetchedEvents = eventsData || [];
      const fetchedTasks = tasksData || [];
      
      // דיבאג - בדיקת מה הגיע
      console.log('Calendar - Tasks loaded:', fetchedTasks.length);
      console.log('Sample task:', fetchedTasks[0]);
      
      // בדיקה איזה תאריכים יש במשימות
      const tasksWithDates = fetchedTasks.filter(task => task.due_date || task.scheduled_start);
      console.log('Tasks with dates:', tasksWithDates.length);

      // Filter and validate tasks
      const openTasks = fetchedTasks.filter(task => {
        if (!task) return false;
        if (task.status === 'completed') return false; // Redundant as already filtered in query, but good for safety

        const dueDate = safeParseDateString(task.due_date);
        const scheduledStart = safeParseDateString(task.scheduled_start);
        return dueDate !== null || scheduledStart !== null;
      });

      const eventIdsWithOpenTasks = new Set(openTasks.map(t => t.related_event_id).filter(id => id));
      const now = new Date();

      // Filter and validate events
      const validEvents = fetchedEvents.filter(event => {
        if (!event) return false;

        const startDate = safeParseDateString(event.start_date);
        if (!startDate) return false;

        const endDate = event.end_date ? safeParseDateString(event.end_date) : startDate;
        if (endDate && isBefore(endDate, now) && !eventIdsWithOpenTasks.has(event.id)) {
          return false;
        }
        return true;
      });

      setEvents(validEvents);
      setTasks(openTasks);
    } catch (error) {
      console.error("Error loading calendar data:", error);
      setEvents([]);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalSave = () => {
    setSelectedItem(null);
    loadData();
  };

  const allItems = [
      ...events.map(e => ({ ...e, itemType: 'event' })),
      ...tasks.map(t => ({ ...t, itemType: 'task' }))
  ];

  const getCombinedItemsForDate = (date) => {
    return allItems.filter(item => {
      const itemDate = safeParseDateString(item.start_date || item.due_date || item.scheduled_start);
      return itemDate && isSameDay(itemDate, date);
    });
  };

  const getTodayEvents = () => getCombinedItemsForDate(new Date());

  const getUpcomingEvents = () => {
    const today = new Date();
    return allItems
      .filter(item => {
        const itemDate = safeParseDateString(item.start_date || item.due_date || item.scheduled_start);
        return itemDate && isBefore(today, itemDate);
      })
      .sort((a, b) => {
        const dateA = safeParseDateString(a.start_date || a.due_date || a.scheduled_start);
        const dateB = safeParseDateString(b.start_date || b.due_date || b.scheduled_start);
        return dateA - dateB;
      })
      .slice(0, 3);
  };

  const categoryColors = {
    // Default event color
    event: "bg-purple-100 text-purple-800 border-purple-200",
    // Default task color
    task: "bg-blue-100 text-blue-800 border-blue-200",
    // Special category colors
    health: "bg-green-100 text-green-800 border-green-200", // Treatments will be green
    meeting: "bg-teal-100 text-teal-800 border-teal-200",
    deadline: "bg-red-100 text-red-800 border-red-200",
    personal: "bg-pink-100 text-pink-800 border-pink-200",
    work: "bg-gray-100 text-gray-800 border-gray-200"
  };

  const priorityColors = {
    low: "border-l-4 border-l-gray-300",
    medium: "border-l-4 border-l-yellow-400",
    high: "border-l-4 border-l-orange-400",
    urgent: "border-l-4 border-l-red-500"
  };

  const importanceColors = {
    low: "text-gray-500",
    medium: "text-blue-500",
    high: "text-purple-600",
  };

  const importanceText = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה' };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          לוח השנה שלי
        </h1>
        <p className="text-xl text-gray-600">
          ניהול פשוט ובהיר של האירועים שלך
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-l from-mint-50 to-blue-50 border-mint-200 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              היום - {format(new Date(), "EEEE, d בMMMM", { locale: he })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getTodayEvents().length > 0 ? (
              <div className="space-y-3">
                {getTodayEvents().map((item) => (
                  <EventCard
                    key={item.id}
                    item={item}
                    categoryColors={categoryColors}
                    priorityColors={priorityColors}
                    importanceColors={importanceColors}
                    importanceText={importanceText}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg text-gray-500 mb-4">אין אירועים מתוכננים להיום</p>
                <Link to={createPageUrl("NewEvent")}>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300">
                    <Plus className="w-5 h-5 ml-2" />
                    הוסף אירוע חדש
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <CalendarHeader
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        view={view}
        setView={setView}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      <motion.div
        key={view}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              items={allItems}
              onDayClick={setSelectedDate}
              onItemClick={setSelectedItem}
              categoryColors={categoryColors}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              items={allItems}
              categoryColors={categoryColors}
              priorityColors={priorityColors}
              onEventClick={setSelectedItem}
            />
          )}
          {view === "day" && (
            <DayView
              selectedDate={selectedDate}
              items={allItems}
              categoryColors={categoryColors}
              priorityColors={priorityColors}
              onEventClick={setSelectedItem}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {getUpcomingEvents().length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-lg border-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-gray-800">
                <Clock className="w-6 h-6 text-orange-500" />
                אירועים קרובים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getUpcomingEvents().map((item) => (
                  <EventCard
                    key={item.id}
                    item={item}
                    categoryColors={categoryColors}
                    priorityColors={priorityColors}
                    importanceColors={importanceColors}
                    importanceText={importanceText}
                    onClick={() => setSelectedItem(item)}
                    showDate={true}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Link to={createPageUrl("NewEvent")}>
        <Button
          size="lg"
          className="fixed bottom-8 left-8 w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-2xl z-50 transition-all duration-300 hover:scale-110"
        >
          <Plus className="w-8 h-8 text-white" />
        </Button>
      </Link>

      <AnimatePresence>
        {selectedItem && (
          <EventDetailsModal
            item={selectedItem}
            itemType={selectedItem.itemType}
            onClose={() => setSelectedItem(null)}
            onSave={handleModalSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
