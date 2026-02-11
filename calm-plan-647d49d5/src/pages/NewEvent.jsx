
import React, { useState, useEffect } from "react";
import { Event, Task, DaySchedule } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, Clock, MapPin, Tag, Bell, Save, ArrowRight, Star, Video, Plus, X, CheckSquare, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { parseISO, isWithinInterval } from "date-fns";
import HolidayAnalyzer from "../components/calendar/HolidayAnalyzer";

export default function NewEventPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [event, setEvent] = useState({
    title: "",
    description: "",
    start_date: new Date().toISOString().slice(0, 16), // Initialized with current date and time
    end_date: "",
    category: "personal",
    priority: "medium",
    importance: "medium",
    location: "",
    meeting_link: "",
    is_all_day: false,
    custom_reminders: [{ minutes_before: 15, type: 'popup' }]
  });

  const [relatedTasks, setRelatedTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    category: "work",
    estimated_minutes: 30
  });

  const [conflict, setConflict] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [isDayOff, setIsDayOff] = useState(false);
  const [dayOffReason, setDayOffReason] = useState("");

  useEffect(() => {
    const fetchAllItems = async () => {
      const [events, tasks] = await Promise.all([Event.list(), Task.list()]);
      setAllItems([...(events || []), ...(tasks || [])]);
    };
    fetchAllItems();
  }, []);

  useEffect(() => {
    const checkDayOff = async () => {
      if (!event.start_date) {
        setIsDayOff(false);
        setDayOffReason("");
        return;
      }
      
      const selectedDate = parseISO(event.start_date);
      const selectedDateString = event.start_date.split("T")[0];
      const dayOfWeek = selectedDate.getDay(); // 0 for Sunday, 6 for Saturday

      const ISRAELI_HOLIDAYS_2024 = {
        "2024-10-03": { name: "ראש השנה א'", type: "holiday" },
        "2024-10-04": { name: "ראש השנה ב'", type: "holiday" },
        "2024-10-12": { name: "יום כפור", type: "holiday" },
        "2024-10-17": { name: "סוכות", type: "holiday" },
        "2024-10-24": { name: "שמחת תורה", type: "holiday" },
        "2024-04-23": { name: "פסח א'", type: "holiday" },
        "2024-04-29": { name: "פסח ז'", type: "holiday" },
        "2024-05-14": { name: "יום העצמאות", type: "holiday" },
        "2024-06-12": { name: "שבועות", type: "holiday" },
      };

      if (ISRAELI_HOLIDAYS_2024[selectedDateString] || dayOfWeek === 6) { 
        const reason = dayOfWeek === 6 ? "שבת" : ISRAELI_HOLIDAYS_2024[selectedDateString].name;
        setIsDayOff(true);
        setDayOffReason(`התאריך שנבחר הוא ${reason}. לא ניתן לתכנן אירועים ביום זה.`);
        return; 
      }
      
      setIsDayOff(false);
      setDayOffReason("");

      try {
        const schedules = await DaySchedule.list("-created_date", 1);
        if (schedules && schedules.length > 0) {
          const latestSchedule = schedules[0];
          const dayOffEvent = latestSchedule.temporary_events?.find(
            (e) => e.is_all_day && e.date === selectedDateString
          );

          if (dayOffEvent) {
              setIsDayOff(true);
              setDayOffReason(`התאריך שנבחר הוגדר כיום חופש (${dayOffEvent.title || 'ללא כותרת'}).`);
          }
        }
      } catch (error) {
        console.error("Error checking for day off:", error);
        setIsDayOff(false);
        setDayOffReason("");
      }
    };

    checkDayOff();
  }, [event.start_date]);

  const checkForConflict = (startTime, endTime) => {
    if (!startTime || !endTime) {
      setConflict(null);
      return;
    }
    
    const start = parseISO(startTime);
    const end = parseISO(endTime);

    const conflictingItem = allItems.find(item => {
      const itemStart = item.start_date ? parseISO(item.start_date) : (item.scheduled_start ? parseISO(item.scheduled_start) : null);
      const itemEnd = item.end_date ? parseISO(item.end_date) : (item.scheduled_end ? parseISO(item.scheduled_end) : null);
      
      if (!itemStart || !itemEnd) return false;
      
      return isWithinInterval(start, { start: itemStart, end: itemEnd }) ||
             isWithinInterval(end, { start: itemStart, end: itemEnd }) ||
             (start < itemStart && end > itemEnd);
    });

    setConflict(conflictingItem);
  };

  const handleInputChange = (field, value) => {
    const newEventState = { ...event, [field]: value };
    setEvent(newEventState);

    if ((field === 'start_date' || field === 'end_date') && newEventState.start_date && newEventState.end_date) {
      checkForConflict(newEventState.start_date, newEventState.end_date);
    } else if (field === 'start_date' && newEventState.is_all_day) {
      const datePart = newEventState.start_date.split("T")[0]; 
      checkForConflict(datePart + "T00:00:00", datePart + "T23:59:59");
    } else if (field === 'is_all_day') {
      if (value && newEventState.start_date) {
        const datePart = newEventState.start_date.split("T")[0];
        checkForConflict(datePart + "T00:00:00", datePart + "T23:59:59");
      } else if (!value && newEventState.start_date && newEventState.end_date) {
        checkForConflict(newEventState.start_date, newEventState.end_date);
      } else {
        setConflict(null);
      }
    }
  };

  const handleTaskChange = (field, value) => {
    setNewTask(prev => ({ ...prev, [field]: value }));
  };

  const addReminder = () => {
    setEvent(prev => ({
      ...prev,
      custom_reminders: [...(prev.custom_reminders || []), { minutes_before: 10, type: 'popup' }]
    }));
  };

  const updateReminder = (index, field, value) => {
    const updatedReminders = [...event.custom_reminders];
    updatedReminders[index][field] = value;
    setEvent(prev => ({ ...prev, custom_reminders: updatedReminders }));
  };

  const removeReminder = (index) => {
    const updatedReminders = event.custom_reminders.filter((_, i) => i !== index);
    setEvent(prev => ({ ...prev, custom_reminders: updatedReminders }));
  };

  const addTask = () => {
    if (!newTask.title) return;
    setRelatedTasks(prev => [...prev, { ...newTask, id: Date.now() }]);
    setNewTask({ title: "", description: "", due_date: "", priority: "medium", category: "work", estimated_minutes: 30 });
    setShowTaskForm(false);
  };

  const removeTask = (taskId) => {
    setRelatedTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDayOff) {
      alert("לא ניתן ליצור אירוע ביום חופש.");
      return;
    }
    setIsLoading(true);
    try {
      let eventData = { ...event };
      if (event.is_all_day) {
        const datePart = event.start_date.split("T")[0];
        eventData.start_date = datePart + "T00:00:00";
        eventData.end_date = datePart + "T23:59:59";
      } else if (!event.end_date && event.start_date) {
        const startTime = new Date(event.start_date);
        startTime.setHours(startTime.getHours() + 1);
        eventData.end_date = startTime.toISOString().slice(0, 16);
      } else if (!event.start_date) {
        alert("יש לבחור תאריך ושעת התחלה לאירוע.");
        setIsLoading(false);
        return;
      }
      
      const createdEvent = await Event.create(eventData);
      
      for (const task of relatedTasks) {
        await Task.create({
          ...task,
          related_event_id: createdEvent.id,
          status: "not_started"
        });
      }
      
      navigate(createPageUrl("Calendar"));
    } catch (error) {
      console.error("שגיאה ביצירת האירוע:", error);
    }
    setIsLoading(false);
  };

  const categories = [
    { value: "work", label: "עבודה", icon: "💼" },
    { value: "personal", label: "אישי", icon: "👤" },
    { value: "health", label: "בריאות", icon: "🏥" },
    { value: "meeting", label: "פגישה", icon: "🤝" },
    { value: "deadline", label: "דדליין", icon: "⏰" },
    { value: "appointment", label: "תור", icon: "📅" }
  ];

  const priorities = [
    { value: "low", label: "נמוכה", color: "text-gray-600" },
    { value: "medium", label: "בינונית", color: "text-yellow-600" },
    { value: "high", label: "גבוהה", color: "text-orange-600" },
    { value: "urgent", label: "דחוף", color: "text-red-600" }
  ];

  const importances = [
    { value: "low", label: "נמוכה", color: "text-neutral-medium" },
    { value: "medium", label: "בינונית", color: "text-status-info" },
    { value: "high", label: "גבוהה", color: "text-primary-dark" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 p-4"
    >
      <Card className="shadow-xl border-border">
        <CardHeader className="bg-gradient-to-l from-primary/10 to-muted/50 border-b border-border">
          <CardTitle className="flex items-center gap-3 text-3xl font-bold text-neutral-dark">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            יצירת אירוע חדש
          </CardTitle>
          <p className="text-gray-500">הוסף אירוע חדש ללוח השנה שלך</p>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {isDayOff ? (
            <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-yellow-800">יום חופש!</h3>
              <p className="text-yellow-700 mt-2">
                {dayOffReason}
                <br />
                לא ניתן להוסיף אירועים ביום זה.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="title" className="text-lg font-semibold text-gray-700 mb-2 block">
                    כותרת האירוע <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="שם האירוע..."
                    value={event.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="p-4 text-lg border-2 border-border focus:border-primary rounded-xl"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description" className="text-lg font-semibold text-gray-700 mb-2 block">
                    תיאור האירוע (אופציונלי)
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="פרטים נוספים על האירוע..."
                    value={event.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="p-4 border-2 border-border focus:border-primary rounded-xl h-24"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  זמן האירוע
                </h3>
                
                <div className="flex items-center gap-4 mb-4">
                  <Switch
                    id="is_all_day"
                    checked={event.is_all_day}
                    onCheckedChange={(checked) => handleInputChange('is_all_day', checked)}
                  />
                  <Label htmlFor="is_all_day" className="text-lg font-semibold text-gray-800">
                    אירוע של יום שלם
                  </Label>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date" className="text-base font-medium text-gray-700 mb-2 block">
                      {event.is_all_day ? "תאריך" : "תאריך ושעת התחלה"} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="start_date"
                      type={event.is_all_day ? "date" : "datetime-local"}
                      value={event.start_date}
                      onChange={(e) => handleInputChange('start_date', e.target.value)}
                      className="p-3 border-2 border-border focus:border-primary rounded-lg"
                      required
                    />
                  </div>
                  
                  {!event.is_all_day && (
                    <div>
                      <Label htmlFor="end_date" className="text-base font-medium text-gray-700 mb-2 block">
                        תאריך ושעת סיום
                      </Label>
                      <Input
                        id="end_date"
                        type="datetime-local"
                        value={event.end_date}
                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                        className="p-3 border-2 border-border focus:border-primary rounded-lg"
                      />
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                   <HolidayAnalyzer 
                      task={{ priority: event.priority, importance: event.importance }} 
                      date={event.start_date}
                      onDateChange={(newDate) => handleInputChange('start_date', newDate)}
                    />
                </div>

              </div>

              {conflict && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>התנגשות בלוח הזמנים!</AlertTitle>
                  <AlertDescription>
                    הזמן שבחרת מתנגש עם: "{conflict.title}".
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Tag className="w-6 h-6 text-purple-600" />
                  סיווג האירוע
                </h3>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-base font-medium text-gray-700 mb-2 block">קטגוריה</Label>
                    <Select value={event.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger className="p-3 border-2 border-gray-200 focus:border-primary rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-base font-medium text-gray-700 mb-2 block">דחיפות</Label>
                    <Select value={event.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                      <SelectTrigger className="p-3 border-2 border-gray-200 focus:border-primary rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <span className={priority.color}>{priority.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-base font-medium text-gray-700 mb-2 block">חשיבות</Label>
                    <Select value={event.importance} onValueChange={(value) => handleInputChange('importance', value)}>
                      <SelectTrigger className="p-3 border-2 border-gray-200 focus:border-primary rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {importances.map((importance) => (
                          <SelectItem key={importance.value} value={importance.value}>
                            <span className={importance.color}>{importance.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-green-600" />
                  מיקום ופגישה
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location" className="text-base font-medium text-gray-700 mb-2 block">
                      מיקום
                    </Label>
                    <Input
                      id="location"
                      placeholder="היכן מתקיים האירוע..."
                      value={event.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="p-3 border-2 border-border focus:border-primary rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meeting_link" className="text-base font-medium text-gray-700 mb-2 block">
                      קישור לפגישה מקוונת
                    </Label>
                    <Input
                      id="meeting_link"
                      placeholder="https://zoom.us/..."
                      value={event.meeting_link}
                      onChange={(e) => handleInputChange('meeting_link', e.target.value)}
                      className="p-3 border-2 border-border focus:border-primary rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-6 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Bell className="w-6 h-6 text-amber-600" />
                    תזכורות
                  </h3>
                  <Button type="button" onClick={addReminder} variant="outline" size="sm">
                    <Plus className="w-4 h-4 ml-1" />
                    הוסף תזכורת
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {event.custom_reminders?.map((reminder, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <Input
                        type="number"
                        placeholder="15"
                        value={reminder.minutes_before}
                        onChange={(e) => updateReminder(index, 'minutes_before', parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-gray-600">דקות לפני</span>
                      <Select 
                        value={reminder.type} 
                        onValueChange={(value) => updateReminder(index, 'type', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popup">חלון קופץ</SelectItem>
                          <SelectItem value="notification">התראה</SelectItem>
                          <SelectItem value="email">אימייל</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button" 
                        onClick={() => removeReminder(index)} 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-indigo-600" />
                    משימות קשורות לאירוע
                  </h3>
                  <Button type="button" onClick={() => setShowTaskForm(!showTaskForm)} variant="outline" size="sm">
                    <Plus className="w-4 h-4 ml-1" />
                    הוסף משימה
                  </Button>
                </div>

                <AnimatePresence>
                  {showTaskForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white p-4 rounded-lg border mb-4 overflow-hidden"
                    >
                      <div className="space-y-4">
                        <Input
                          placeholder="שם המשימה..."
                          value={newTask.title}
                          onChange={(e) => handleTaskChange('title', e.target.value)}
                        />
                        <Textarea
                          placeholder="תיאור המשימה..."
                          value={newTask.description}
                          onChange={(e) => handleTaskChange('description', e.target.value)}
                          className="h-20"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Select value={newTask.priority} onValueChange={(value) => handleTaskChange('priority', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="דחיפות" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">נמוכה</SelectItem>
                              <SelectItem value="medium">בינונית</SelectItem>
                              <SelectItem value="high">גבוהה</SelectItem>
                              <SelectItem value="urgent">דחוף</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="זמן משוער (דקות)"
                            value={newTask.estimated_minutes}
                            onChange={(e) => handleTaskChange('estimated_minutes', parseInt(e.target.value))}
                          />
                          <Input
                            type="datetime-local"
                            placeholder="תאריך ושעת יעד"
                            value={newTask.due_date}
                            onChange={(e) => handleTaskChange('due_date', e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={addTask} variant="outline" size="sm">
                            הוסף משימה
                          </Button>
                          <Button type="button" onClick={() => setShowTaskForm(false)} variant="ghost" size="sm">
                            ביטול
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  {relatedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <h4 className="font-semibold">{task.title}</h4>
                        <p className="text-sm text-gray-600">{task.description}</p>
                      </div>
                      <Button 
                        type="button" 
                        onClick={() => removeTask(task.id)} 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-4 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1 py-4 text-lg rounded-xl border-2 hover:bg-gray-50 transition-all duration-300"
                >
                  ביטול
                </Button>
                
                <Button
                  type="submit"
                  disabled={isLoading || !event.title || !event.start_date || !!conflict || isDayOff}
                  className="flex-1 py-4 text-lg bg-primary hover:bg-accent rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {isLoading ? (
                    'יוצר אירוע...'
                  ) : (
                    'צור אירוע'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
