
import React, { useState, useEffect, useRef } from 'react';
import { DaySchedule, SystemConfig } from '@/api/entities';
import { injectRecurringTasks } from '@/engines/TaskInjectionEngine';
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
  AlertTriangle, CheckCircle, Ship, PartyPopper, Cake, TreePalm
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

// ── Israeli Holidays 2026 (complete: erev chag, chag, chol hamoed) ──
const ISRAELI_HOLIDAYS_2026 = [
  // פורים
  { date: "2026-03-03", title: "תענית אסתר", type: "day_off", subtype: "erev" },
  { date: "2026-03-04", title: "פורים", type: "day_off", subtype: "holiday" },
  { date: "2026-03-05", title: "שושן פורים", type: "day_off", subtype: "holiday" },
  // פסח
  { date: "2026-04-01", title: "ערב פסח", type: "day_off", subtype: "erev" },
  { date: "2026-04-02", title: "פסח א׳", type: "day_off", subtype: "holiday" },
  { date: "2026-04-03", title: "חול המועד פסח א׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-04-04", title: "חול המועד פסח ב׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-04-05", title: "חול המועד פסח ג׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-04-06", title: "חול המועד פסח ד׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-04-07", title: "חול המועד פסח ה׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-04-08", title: "שביעי של פסח", type: "day_off", subtype: "holiday" },
  // יום הזיכרון + יום העצמאות
  { date: "2026-04-21", title: "יום הזיכרון", type: "day_off", subtype: "erev" },
  { date: "2026-04-22", title: "יום העצמאות", type: "day_off", subtype: "holiday" },
  // ל״ג בעומר
  { date: "2026-05-05", title: "ל״ג בעומר", type: "day_off", subtype: "holiday" },
  // שבועות
  { date: "2026-05-21", title: "ערב שבועות", type: "day_off", subtype: "erev" },
  { date: "2026-05-22", title: "שבועות", type: "day_off", subtype: "holiday" },
  // ט׳ באב
  { date: "2026-07-23", title: "ערב ט׳ באב", type: "day_off", subtype: "erev" },
  { date: "2026-07-24", title: "ט׳ באב", type: "day_off", subtype: "holiday" },
  // ראש השנה
  { date: "2026-09-11", title: "ערב ראש השנה", type: "day_off", subtype: "erev" },
  { date: "2026-09-12", title: "ראש השנה א׳", type: "day_off", subtype: "holiday" },
  { date: "2026-09-13", title: "ראש השנה ב׳", type: "day_off", subtype: "holiday" },
  // צום גדליה
  { date: "2026-09-14", title: "צום גדליה", type: "day_off", subtype: "erev" },
  // יום כיפור
  { date: "2026-09-20", title: "ערב יום כיפור", type: "day_off", subtype: "erev" },
  { date: "2026-09-21", title: "יום כיפור", type: "day_off", subtype: "holiday" },
  // סוכות
  { date: "2026-09-25", title: "ערב סוכות", type: "day_off", subtype: "erev" },
  { date: "2026-09-26", title: "סוכות א׳", type: "day_off", subtype: "holiday" },
  { date: "2026-09-27", title: "חול המועד סוכות א׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-09-28", title: "חול המועד סוכות ב׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-09-29", title: "חול המועד סוכות ג׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-09-30", title: "חול המועד סוכות ד׳", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-10-01", title: "הושענא רבה", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-10-02", title: "שמיני עצרת", type: "day_off", subtype: "holiday" },
  { date: "2026-10-03", title: "שמחת תורה", type: "day_off", subtype: "holiday" },
  // חנוכה
  { date: "2026-12-12", title: "חנוכה - נר ראשון", type: "day_off", subtype: "holiday" },
  { date: "2026-12-13", title: "חנוכה - נר שני", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-14", title: "חנוכה - נר שלישי", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-15", title: "חנוכה - נר רביעי", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-16", title: "חנוכה - נר חמישי", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-17", title: "חנוכה - נר שישי", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-18", title: "חנוכה - נר שביעי", type: "chol_hamoed", subtype: "chol_hamoed" },
  { date: "2026-12-19", title: "חנוכה - נר שמיני", type: "chol_hamoed", subtype: "chol_hamoed" },
];

// ── August quiet period (הדממה) ──
const AUGUST_QUIET_2026 = (() => {
  const days = [];
  for (let d = 16; d <= 31; d++) {
    const dd = String(d).padStart(2, '0');
    days.push({
      date: `2026-08-${dd}`,
      title: `הדממת אוגוסט — מנוחה`,
      type: 'quiet_period',
      subtype: 'quiet',
      is_all_day: true,
    });
  }
  return days;
})();

// ── Family birthdays (placeholders — user should set real dates) ──
const FAMILY_BIRTHDAYS_2026 = [
  { date: "2026-01-01", title: "🎂 יום הולדת שלי", type: "birthday", subtype: "birthday", is_all_day: true },
  { date: "2026-01-01", title: "🎂 יום הולדת בעלי", type: "birthday", subtype: "birthday", is_all_day: true },
  { date: "2026-01-01", title: "🎂 יום הולדת ילד/ה 1", type: "birthday", subtype: "birthday", is_all_day: true },
  { date: "2026-01-01", title: "🎂 יום הולדת ילד/ה 2", type: "birthday", subtype: "birthday", is_all_day: true },
];

const getHolidaysForYear = (year) => {
  if (year === 2026) {
    return ISRAELI_HOLIDAYS_2026.map(h => ({
      date: h.date,
      is_all_day: true,
      title: h.title,
      type: h.type,
      subtype: h.subtype,
    }));
  }
  return [];
};

const getAugustQuiet = () => AUGUST_QUIET_2026;
const getFamilyBirthdays = () => FAMILY_BIRTHDAYS_2026;

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
      const schedules = await DaySchedule.list(null, 1);
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

      // 1. Save to DaySchedule entity
      const existingSchedules = await DaySchedule.list(null, 1);
      if (existingSchedules && existingSchedules.length > 0) {
        await DaySchedule.update(existingSchedules[0].id, scheduleData);
      } else {
        await DaySchedule.create(scheduleData);
      }

      // 2. Sync to SystemConfig DNA so the rest of the app knows work hours changed
      try {
        const configs = await SystemConfig.list(null, 50);
        const dnaConfig = configs.find(c => c.config_key === 'biological_week');
        const dnaPayload = {
          work_start: schedule.work_start,
          work_end: schedule.work_end,
          meal_times: schedule.meal_times,
          break_reminders: schedule.break_reminders,
          updated_at: new Date().toISOString(),
        };
        if (dnaConfig) {
          await SystemConfig.update(dnaConfig.id, { data: dnaPayload });
        } else {
          await SystemConfig.create({ config_key: 'biological_week', data: dnaPayload });
        }
      } catch (dnaErr) {
        console.warn('[LifeSettings] DNA sync failed (non-fatal):', dnaErr);
      }

      // 3. Trigger task injection engine — generate recurring tasks based on new schedule
      try {
        const injected = await injectRecurringTasks();
        if (injected.length > 0) {
          console.log(`[LifeSettings] Injected ${injected.length} recurring task(s) after schedule save`);
        }
      } catch (injErr) {
        console.warn('[LifeSettings] Task injection failed (non-fatal):', injErr);
      }

      setHasChanges(false);
      alert('השבוע הביולוגי נשמר בהצלחה!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('שגיאה בשמירת השבוע הביולוגי');
    }
    setIsSaving(false);
  };

  // Auto-inject tasks when schedule work hours change
  const prevWorkHoursRef = useRef(`${schedule.work_start}-${schedule.work_end}`);
  useEffect(() => {
    const key = `${schedule.work_start}-${schedule.work_end}`;
    if (key !== prevWorkHoursRef.current && !isLoading) {
      prevWorkHoursRef.current = key;
      setHasChanges(true);
    }
  }, [schedule.work_start, schedule.work_end, isLoading]);

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
    const holidays = getHolidaysForYear(2026);
    const existingDates = new Set((schedule.temporary_events || []).map(e => e.date));
    const newHolidays = holidays.filter(h => !existingDates.has(h.date));

    if(newHolidays.length > 0) {
        updateSchedule('temporary_events', [...(schedule.temporary_events || []), ...newHolidays]);
        alert(`נוספו ${newHolidays.length} חגים (כולל ערבי חג וחול המועד).`);
    } else {
        alert("כל החגים כבר נוספו למערכת.");
    }
  };

  const addAugustQuiet = () => {
    const quietDays = getAugustQuiet();
    const existingDates = new Set((schedule.temporary_events || []).map(e => e.date));
    const newDays = quietDays.filter(d => !existingDates.has(d.date));
    if (newDays.length > 0) {
      updateSchedule('temporary_events', [...(schedule.temporary_events || []), ...newDays]);
      alert(`נוספו ${newDays.length} ימי הדממת אוגוסט (16-31.8).`);
    } else {
      alert("הדממת אוגוסט כבר נוספה.");
    }
  };

  const addBirthdays = () => {
    const bdays = getFamilyBirthdays();
    const existingTitles = new Set((schedule.temporary_events || []).map(e => e.title));
    const newBdays = bdays.filter(b => !existingTitles.has(b.title));
    if (newBdays.length > 0) {
      updateSchedule('temporary_events', [...(schedule.temporary_events || []), ...newBdays]);
      alert(`נוספו ${newBdays.length} ימי הולדת. עדכני את התאריכים!`);
    } else {
      alert("ימי ההולדת כבר נוספו.");
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
      .filter(event => event.is_all_day)
      .map(event => event.date)
      .sort();
  };

  const getEventByDate = (date) => {
    return (schedule.temporary_events || []).find(e => e.date === date);
  };

  const getEventBadge = (event) => {
    if (!event) return null;
    const type = event.subtype || event.type;
    switch (type) {
      case 'holiday': return { label: 'חג', color: 'bg-red-100 text-red-700' };
      case 'erev': return { label: 'ערב חג', color: 'bg-orange-100 text-orange-700' };
      case 'chol_hamoed': return { label: 'חוה״מ', color: 'bg-amber-100 text-amber-700' };
      case 'quiet': return { label: 'הדממה', color: 'bg-blue-100 text-blue-700' };
      case 'birthday': return { label: 'יום הולדת', color: 'bg-pink-100 text-pink-700' };
      default: return { label: 'חופש', color: 'bg-green-100 text-green-700' };
    }
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
            <Save className="w-4 h-4 ms-2" />
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
                    className="text-amber-500 hover:text-amber-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button onClick={addMealTime} variant="outline" className="w-full">
              <Plus className="w-4 h-4 ms-2" />
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
                    className="text-amber-500 hover:text-amber-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button onClick={addBreakReminder} variant="outline" className="w-full">
              <Plus className="w-4 h-4 ms-2" />
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
              <Label className="font-semibold flex items-center gap-2 mb-2"><PartyPopper className="w-4 h-4"/>חגי ישראל 2026</Label>
              <p className="text-xs text-gray-500 mb-2">כולל ערבי חג, חגים, וחול המועד (חוה״מ = עובדים רק אם אין ברירה)</p>
              <Button onClick={addHolidays} variant="outline" className="w-full">
                הוסף את כל חגי ישראל 2026 (כולל ערבי חג וחוה״מ)
              </Button>
            </div>

            <Separator/>

            <div>
              <Label className="font-semibold flex items-center gap-2 mb-2"><TreePalm className="w-4 h-4"/>הדממת אוגוסט</Label>
              <p className="text-xs text-gray-500 mb-2">מחצית שנייה של אוגוסט (16-31) — עומס מינימלי, מנוחה ואיפוס</p>
              <Button onClick={addAugustQuiet} variant="outline" className="w-full">
                הוסף הדממת אוגוסט (16-31.8.2026)
              </Button>
            </div>

            <Separator/>

            <div>
              <Label className="font-semibold flex items-center gap-2 mb-2"><Cake className="w-4 h-4"/>ימי הולדת משפחה</Label>
              <p className="text-xs text-gray-500 mb-2">יתווספו עם תאריך placeholder — עדכני את התאריכים הנכונים אחרי ההוספה</p>
              <Button onClick={addBirthdays} variant="outline" className="w-full">
                הוסף ימי הולדת (שלי, בעלי, ילדים)
              </Button>
            </div>

            <Separator/>

            <div className="space-y-2">
              <h4 className="font-semibold">ימים חסומים ואירועים ({getDayOffDates().length}):</h4>
              <AnimatePresence>
                {getDayOffDates().map((date) => {
                  const event = getEventByDate(date);
                  const badge = getEventBadge(event);
                  return (
                    <motion.div
                      key={date}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        event?.subtype === 'holiday' ? 'bg-red-50 border-red-200' :
                        event?.subtype === 'erev' ? 'bg-orange-50 border-orange-200' :
                        event?.subtype === 'chol_hamoed' ? 'bg-amber-50 border-amber-200' :
                        event?.subtype === 'quiet' ? 'bg-blue-50 border-blue-200' :
                        event?.subtype === 'birthday' ? 'bg-pink-50 border-pink-200' :
                        'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm">{format(new Date(date), 'EEEE, d בMMMM yyyy', { locale: he })}</span>
                        {event?.title && <span className="text-xs text-gray-600 truncate">— {event.title}</span>}
                        {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDayOff(date)}
                        className="text-amber-500 hover:text-amber-700 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  );
                })}
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
          <Save className="w-5 h-5 ms-2" />
          {isSaving ? 'שומר...' : hasChanges ? 'שמור את השבוע הביולוגי' : 'הכל שמור'}
        </Button>
      </motion.div>
    </div>
  );
}
