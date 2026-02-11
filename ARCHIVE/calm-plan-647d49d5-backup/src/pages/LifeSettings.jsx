
import React, { useState, useEffect } from 'react';
import { DaySchedule } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, Brain, Heart, Coffee, Moon, Sun, Utensils, 
  Calendar, Plus, X, Save, Bell, Target, Home,
  AlertTriangle, CheckCircle, Ship, PartyPopper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

const ISRAELI_HOLIDAYS_2024 = [
  "2024-10-02", "2024-10-03", "2024-10-04",
  "2024-10-11", "2024-10-12",
  "2024-10-16", "2024-10-17", "2024-10-18", "2024-10-19", "2024-10-20", "2024-10-21", "2024-10-22",
  "2024-10-23", "2024-10-24",
  "2024-04-22", "2024-04-23", "2024-04-24", "2024-04-25", "2024-04-26", "2024-04-27", "2024-04-28", "2024-04-29",
  "2024-05-13", "2024-05-14",
  "2024-06-11", "2024-06-12",
];

const getHolidaysForYear = (year) => {
    if (year === 2024) {
        return ISRAELI_HOLIDAYS_2024.map(date => ({
            date: date,
            is_all_day: true,
            title: `חג / ערב חג`,
            type: 'day_off'
        }));
    }
    return [];
}

export default function LifeSettingsPage() {
  const [schedule, setSchedule] = useState({
    morning_prep_start: '06:00',
    morning_prep_end: '08:00',
    work_start: '08:15',
    work_end: '16:15',
    evening_start: '17:00',
    evening_end: '20:00',
    personal_time_start: '20:30',
    personal_time_end: '22:00',
    meal_times: [
      { name: 'ארוחת בוקר', time: '07:00', duration_minutes: 30 },
      { name: 'ארוחת צהריים', time: '13:00', duration_minutes: 45 },
      { name: 'ארוחת פרי', time: '16:00', duration_minutes: 15 },
      { name: 'ארוחת ערב', time: '19:00', duration_minutes: 60 }
    ],
    break_reminders: [
      { time: '10:30', type: 'water', message: 'זמן לשתות מים' },
      { time: '15:00', type: 'stretch', message: 'זמן להתמתח ולנוח' }
    ],
    temporary_events: [],
    couple_time_day: false,
    fitness_time: '07:30'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newDayOff, setNewDayOff] = useState('');
  const [vacation, setVacation] = useState({ start: '', end: '' });

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const schedules = await DaySchedule.list('-created_date', 1);
      if (schedules && schedules.length > 0) {
        const existingSchedule = schedules[0];
        setSchedule({
          ...schedule,
          ...existingSchedule,
          temporary_events: existingSchedule.temporary_events || []
        });
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const scheduleData = {
        ...schedule,
        date: format(new Date(), 'yyyy-MM-dd')
      };
      
      const existingSchedules = await DaySchedule.list('-created_date', 1);
      if (existingSchedules && existingSchedules.length > 0) {
        await DaySchedule.update(existingSchedules[0].id, scheduleData);
      } else {
        await DaySchedule.create(scheduleData);
      }
      
      setHasChanges(false);
      alert('השבוע הביולוגי נשמר בהצלחה!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('שגיאה בשמירת השבוע הביולוגי');
    }
    setIsSaving(false);
  };

  const updateSchedule = (field, value) => {
    setSchedule(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addMealTime = () => {
    const newMeal = { name: 'ארוחת יוגורט', time: '10:00', duration_minutes: 10 };
    updateSchedule('meal_times', [...schedule.meal_times, newMeal]);
  };

  const updateMealTime = (index, field, value) => {
    const updatedMeals = schedule.meal_times.map((meal, i) => 
      i === index ? { ...meal, [field]: value } : meal
    );
    updateSchedule('meal_times', updatedMeals);
  };

  const removeMealTime = (index) => {
    const updatedMeals = schedule.meal_times.filter((_, i) => i !== index);
    updateSchedule('meal_times', updatedMeals);
  };

  const addBreakReminder = () => {
    const newBreak = { time: '14:00', type: 'water', message: 'תזכורת חדשה' };
    updateSchedule('break_reminders', [...schedule.break_reminders, newBreak]);
  };

  const updateBreakReminder = (index, field, value) => {
    const updatedBreaks = schedule.break_reminders.map((breakItem, i) => 
      i === index ? { ...breakItem, [field]: value } : breakItem
    );
    updateSchedule('break_reminders', updatedBreaks);
  };

  const removeBreakReminder = (index) => {
    const updatedBreaks = schedule.break_reminders.filter((_, i) => i !== index);
    updateSchedule('break_reminders', updatedBreaks);
  };

  const addDayOff = () => {
    if (!newDayOff) return;
    
    const dayOffEvent = {
      date: newDayOff,
      is_all_day: true,
      title: 'יום חופש',
      type: 'day_off'
    };
    
    const existingDates = new Set((schedule.temporary_events || []).map(e => e.date));
    if (existingDates.has(dayOffEvent.date)) {
        alert("יום זה כבר קיים ברשימת ימי החופש/אירועים זמניים.");
        return;
    }

    const updatedEvents = [...(schedule.temporary_events || []), dayOffEvent];
    updateSchedule('temporary_events', updatedEvents);
    setNewDayOff('');
  };

  const addVacation = () => {
    if (!vacation.start || !vacation.end) return;

    const startDate = new Date(vacation.start);
    const endDate = new Date(vacation.end);

    if (startDate > endDate) {
      alert("תאריך סיום החופשה חייב להיות אחרי תאריך ההתחלה.");
      return;
    }

    const days = eachDayOfInterval({
      start: startDate,
      end: endDate
    });

    const vacationEvents = days.map(day => ({
      date: format(day, 'yyyy-MM-dd'),
      is_all_day: true,
      title: 'חופשה',
      type: 'day_off'
    }));

    const existingDates = new Set((schedule.temporary_events || []).map(e => e.date));
    const newEvents = vacationEvents.filter(e => !existingDates.has(e.date));
    
    if (newEvents.length > 0) {
      updateSchedule('temporary_events', [...(schedule.temporary_events || []), ...newEvents]);
      setVacation({ start: '', end: '' });
    } else {
      alert("כל הימים בטווח התאריכים הנבחר כבר קיימים כאירועים זמניים.");
    }
  };
  
  const addHolidays = () => {
    const holidays = getHolidaysForYear(new Date().getFullYear());
    const existingDates = new Set((schedule.temporary_events || []).map(e => e.date));
    const newHolidays = holidays.filter(h => !existingDates.has(h.date));
    
    if(newHolidays.length > 0) {
        updateSchedule('temporary_events', [...(schedule.temporary_events || []), ...newHolidays]);
        alert(`נוספו ${newHolidays.length} חגים לרשימת ימי החופש.`);
    } else {
        alert("כל החגים עבור שנה זו כבר נוספו למערכת.");
    }
  };

  const removeDayOff = (dateToRemove) => {
    const updatedEvents = (schedule.temporary_events || []).filter(
      event => event.date !== dateToRemove
    );
    updateSchedule('temporary_events', updatedEvents);
  };

  const getDayOffDates = () => {
    return (schedule.temporary_events || [])
      .filter(event => event.is_all_day && event.type === 'day_off')
      .map(event => event.date)
      .sort();
  };

  const getContextualMessage = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour >= 6 && currentHour < 8) {
      return "זמן הכנה לבוקר - הכן את עצמך ליום פרודוקטיבי";
    } else if (currentHour >= 8 && currentHour < 16) {
      return "זמן עבודה - תקופת הריכוז והפרודוקטיביות שלך";
    } else if (currentHour >= 17 && currentHour < 20) {
      return "זמן ערב - הזדמנות לסיכום היום והתארגנות";
    } else if (currentHour >= 20) {
      return "זמן אישי - רגע לטפל בעצמך ובמשפחה";
    } else {
      return "זמן מנוחה - חשוב לשמור על איזון";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded animate-pulse"></div>
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-primary">השבוע הביולוגי שלי</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          הגדר את הקצב הטבעי שלך לחיים מאוזנים ופרודוקטיביים
        </p>
        <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
          <p className="text-primary font-medium">{getContextualMessage()}</p>
        </div>
      </motion.div>

      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-4 z-50"
        >
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-500 hover:bg-green-600 shadow-lg"
          >
            <Save className="w-4 h-4 ml-2" />
            {isSaving ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-6 h-6" />
              לוח זמנים יומי בסיסי
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-primary/90 flex items-center gap-2">
                  <Sun className="w-5 h-5" />
                  זמני בוקר
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label>התחלת הכנה לבוקר</Label>
                    <Input
                      type="time"
                      value={schedule.morning_prep_start}
                      onChange={(e) => updateSchedule('morning_prep_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>סיום הכנה לבוקר</Label>
                    <Input
                      type="time"
                      value={schedule.morning_prep_end}
                      onChange={(e) => updateSchedule('morning_prep_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-primary/90 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  זמני עבודה
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label>התחלת עבודה</Label>
                    <Input
                      type="time"
                      value={schedule.work_start}
                      onChange={(e) => updateSchedule('work_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>סיום עבודה</Label>
                    <Input
                      type="time"
                      value={schedule.work_end}
                      onChange={(e) => updateSchedule('work_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <Moon className="w-5 h-5" />
                  זמני ערב
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label>התחלת ערב</Label>
                    <Input
                      type="time"
                      value={schedule.evening_start}
                      onChange={(e) => updateSchedule('evening_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>סיום ערב</Label>
                    <Input
                      type="time"
                      value={schedule.evening_end}
                      onChange={(e) => updateSchedule('evening_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  זמן אישי
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label>התחלת זמן אישי</Label>
                    <Input
                      type="time"
                      value={schedule.personal_time_start}
                      onChange={(e) => updateSchedule('personal_time_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>סיום זמן אישי</Label>
                    <Input
                      type="time"
                      value={schedule.personal_time_end}
                      onChange={(e) => updateSchedule('personal_time_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Utensils className="w-6 h-6" />
              תכנון תזונה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {schedule.meal_times.map((meal, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border"
                >
                  <Input
                    placeholder="שם הארוחה"
                    value={meal.name}
                    onChange={(e) => updateMealTime(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="time"
                    value={meal.time}
                    onChange={(e) => updateMealTime(index, 'time', e.target.value)}
                    className="w-32"
                  />
                  <Input
                    type="number"
                    placeholder="דקות"
                    value={meal.duration_minutes}
                    onChange={(e) => updateMealTime(index, 'duration_minutes', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMealTime(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button onClick={addMealTime} variant="outline" className="w-full">
              <Plus className="w-4 h-4 ml-2" />
              הוסף ארוחה / נשנוש
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Bell className="w-6 h-6" />
              תזכורות הפסקות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {schedule.break_reminders.map((breakItem, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border"
                >
                  <Input
                    type="time"
                    value={breakItem.time}
                    onChange={(e) => updateBreakReminder(index, 'time', e.target.value)}
                    className="w-32"
                  />
                  <select
                    value={breakItem.type}
                    onChange={(e) => updateBreakReminder(index, 'type', e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="water">מים</option>
                    <option value="break">הפסקה</option>
                    <option value="stretch">התמתחות</option>
                  </select>
                  <Input
                    placeholder="הודעת התזכורת"
                    value={breakItem.message}
                    onChange={(e) => updateBreakReminder(index, 'message', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBreakReminder(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button onClick={addBreakReminder} variant="outline" className="w-full">
              <Plus className="w-4 h-4 ml-2" />
              הוסף תזכורת
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Calendar className="w-6 h-6" />
              ניהול ימי חופש
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="font-semibold flex items-center gap-2 mb-2"><Plus className="w-4 h-4"/>הוסף יום חופש בודד</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newDayOff}
                  onChange={(e) => setNewDayOff(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addDayOff} disabled={!newDayOff}>
                  הוסף
                </Button>
              </div>
            </div>
            <Separator/>
            <div>
              <Label className="font-semibold flex items-center gap-2 mb-2"><Ship className="w-4 h-4"/>הוסף חופשה רציפה</Label>
              <div className="flex flex-col md:flex-row gap-2">
                <Input type="date" value={vacation.start} onChange={(e) => setVacation({...vacation, start: e.target.value})} />
                <Input type="date" value={vacation.end} onChange={(e) => setVacation({...vacation, end: e.target.value})} />
                <Button onClick={addVacation} disabled={!vacation.start || !vacation.end} className="w-full md:w-auto">הוסף חופשה</Button>
              </div>
            </div>
             <Separator/>
            <div>
              <Label className="font-semibold flex items-center gap-2 mb-2"><PartyPopper className="w-4 h-4"/>חגי ישראל</Label>
              <Button onClick={addHolidays} variant="outline" className="w-full">
                הוסף את כל חגי ישראל ({new Date().getFullYear()}) לימי החופש
              </Button>
            </div>
            
            <Separator/>

            <div className="space-y-2">
              <h4 className="font-semibold">ימים חסומים:</h4>
              <AnimatePresence>
                {getDayOffDates().map((date) => (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{format(new Date(date), 'EEEE, d בMMMM yyyy', { locale: he })}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDayOff(date)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {getDayOffDates().length === 0 && (
                <p className="text-gray-500 text-center py-4">אין ימי חופש מתוכננים</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Home className="w-6 h-6" />
              הגדרות אישיות נוספות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">יום זוגי מתוכנן</Label>
                <p className="text-sm text-gray-600">האם יש יום קבוע לזמן זוגי?</p>
              </div>
              <Switch
                checked={schedule.couple_time_day}
                onCheckedChange={(checked) => updateSchedule('couple_time_day', checked)}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>זמן מומלץ לפעילות גופנית</Label>
              <Input
                type="time"
                value={schedule.fitness_time}
                onChange={(e) => updateSchedule('fitness_time', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex justify-center pt-6"
      >
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          size="lg"
          className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg"
        >
          <Save className="w-5 h-5 ml-2" />
          {isSaving ? 'שומר...' : hasChanges ? 'שמור את השבוע הביולוגי' : 'הכל שמור'}
        </Button>
      </motion.div>
    </div>
  );
}
