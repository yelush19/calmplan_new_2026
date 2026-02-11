
import React, { useState, useEffect } from "react";
import { Event } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Calendar, Download, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";

export default function PrintPage() {
  const [events, setEvents] = useState([]);
  const [printView, setPrintView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const fetchedEvents = await Event.list("-start_date");
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("שגיאה בטעינת אירועים:", error);
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const getEventsForDate = (date) => {
    if (!events) return [];
    return events.filter(event => {
      if (!event.start_date) return false;
      const eventDate = parseISO(event.start_date);
      return isSameDay(eventDate, date);
    });
  };

  const getEventsForRange = (startDate, endDate) => {
    if (!events) return [];
    return events.filter(event => {
      if (!event.start_date) return false;
      const eventDate = parseISO(event.start_date);
      return eventDate >= startDate && eventDate <= endDate;
    });
  };

  const renderMonthView = () => {
    const date = new Date(selectedDate);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { locale: he });
    const calendarEnd = endOfWeek(monthEnd, { locale: he });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const dayNames = ["ראש", "שני", "שלי", "רבי", "חמי", "שיש", "שבת"];

    return (
      <div className="print-content bg-white p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {format(date, "MMMM yyyy", { locale: he })}
          </h1>
          <p className="text-gray-600">לוח שנה חודשי</p>
        </div>

        <div className="grid grid-cols-7 gap-0 border border-gray-300">
          {/* כותרות הימים */}
          {dayNames.map((day) => (
            <div key={day} className="p-3 text-center font-bold bg-gray-100 border border-gray-300">
              {day}
            </div>
          ))}
          
          {/* ימי החודש */}
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = day.getMonth() === date.getMonth();
            
            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[120px] p-2 border border-gray-300 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className={`text-sm font-medium mb-2 ${
                  isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
                }`}>
                  {format(day, "d")}
                </div>
                
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div 
                      key={event.id}
                      className="text-xs p-1 bg-blue-100 rounded text-blue-800 truncate"
                    >
                      {event.title}
                      {!event.is_all_day && event.start_date && (
                        <span className="text-blue-600">
                          {' '}{format(parseISO(event.start_date), "HH:mm")}
                        </span>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} נוספים
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const date = new Date(selectedDate);
    const weekStart = startOfWeek(date, { locale: he });
    const weekEnd = endOfWeek(date, { locale: he });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="print-content bg-white p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            שבוע של {format(date, "d בMMMM yyyy", { locale: he })}
          </h1>
          <p className="text-gray-600">לוח שנה שבועי</p>
        </div>

        <div className="space-y-6">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            
            return (
              <div key={day.toISOString()} className="border border-gray-300 rounded-lg">
                <div className="bg-gray-100 p-4 border-b border-gray-300">
                  <h2 className="text-xl font-bold text-gray-800">
                    {format(day, "EEEE, d בMMMM", { locale: he })}
                  </h2>
                </div>
                
                <div className="p-4">
                  {dayEvents.length > 0 ? (
                    <div className="space-y-3">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="border-r-4 border-r-blue-500 pr-4 py-2">
                          <h3 className="font-semibold text-lg">{event.title}</h3>
                          {event.description && (
                            <p className="text-gray-600 text-sm mt-1">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                            {!event.is_all_day && event.start_date && event.end_date && (
                              <span>
                                {format(parseISO(event.start_date), "HH:mm")} - 
                                {format(parseISO(event.end_date), "HH:mm")}
                              </span>
                            )}
                            {event.location && <span>📍 {event.location}</span>}
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {(event.category || 'personal').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">אין אירועים ליום זה</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const date = new Date(selectedDate);
    const dayEvents = getEventsForDate(date);

    return (
      <div className="print-content bg-white p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {format(date, "EEEE, d בMMMM yyyy", { locale: he })}
          </h1>
          <p className="text-gray-600">תכנית יומית</p>
        </div>

        {dayEvents.length > 0 ? (
          <div className="space-y-4">
            {dayEvents.map((event) => (
              <div key={event.id} className="border border-gray-300 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">{event.title}</h2>
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {(event.category || 'personal').replace(/_/g, ' ')}
                  </div>
                </div>
                
                {event.description && (
                  <p className="text-gray-700 mb-4">{event.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {!event.is_all_day && event.start_date && event.end_date && (
                    <div>
                      <strong>שעות:</strong> {format(parseISO(event.start_date), "HH:mm")} - 
                      {format(parseISO(event.end_date), "HH:mm")}
                    </div>
                  )}
                  
                  {event.location && (
                    <div>
                      <strong>מיקום:</strong> {event.location}
                    </div>
                  )}
                  
                  {event.priority && (
                    <div>
                      <strong>דחיפות:</strong> {event.priority}
                    </div>
                  )}
                  
                  {event.reminder_minutes > 0 && (
                    <div>
                      <strong>תזכורת:</strong> {event.reminder_minutes} דקות לפני
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">אין אירועים מתוכננים ליום זה</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-content, .print-content * {
              visibility: visible;
            }
            .print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      {/* אפשרויות הדפסה */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print"
      >
        <Card className="shadow-xl border-gray-100">
          <CardHeader className="bg-gradient-to-l from-mint-50 to-blue-50 border-b border-mint-200">
            <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
              <div className="w-8 h-8 bg-mint-500 rounded-full flex items-center justify-center">
                <Printer className="w-5 h-5 text-white" />
              </div>
              הדפסת לוח שנה
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div>
                <Label className="text-lg font-semibold text-gray-700 mb-2 block">
                  סוג תצוגה
                </Label>
                <Select value={printView} onValueChange={setPrintView}>
                  <SelectTrigger className="p-4 border-2 border-gray-200 focus:border-mint-500 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">יום</SelectItem>
                    <SelectItem value="week">שבוע</SelectItem>
                    <SelectItem value="month">חודש</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-lg font-semibold text-gray-700 mb-2 block">
                  תאריך
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="p-4 border-2 border-gray-200 focus:border-mint-500 rounded-xl"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handlePrint}
                  className="w-full py-4 text-lg bg-mint-500 hover:bg-mint-600 rounded-xl shadow-lg transition-all duration-300"
                >
                  <Printer className="w-5 h-5 ml-2" />
                  הדפס
                </Button>
              </div>
            </div>

            <div className="text-center text-gray-600">
              <p className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                תצוגה מקדימה של הדפסה מופיעה מתחת
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* תצוגה מקדימה */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg"
      >
        {printView === "month" && renderMonthView()}
        {printView === "week" && renderWeekView()}
        {printView === "day" && renderDayView()}
      </motion.div>
    </div>
  );
}
