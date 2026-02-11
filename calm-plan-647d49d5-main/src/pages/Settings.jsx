import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DaySchedule, WeeklyRecommendation } from '@/api/entities';
import { Clock, Sun, Moon, Coffee, Save, Lightbulb, Bell, CheckCircle, Plus, X } from 'lucide-react';

export default function SettingsPage() {
  const [schedule, setSchedule] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mealReminders, setMealReminders] = useState([
    { name: "ארוחת בוקר", time: "07:30", enabled: true },
    { name: "ארוחת צהריים", time: "13:00", enabled: true },
    { name: "ארוחת ערב", time: "19:00", enabled: true }
  ]);
  const [breakReminders, setBreakReminders] = useState([
    { type: "water", time: "10:00", message: "זמן לשתות מים", enabled: true },
    { type: "break", time: "15:00", message: "הפסקה קצרה", enabled: true },
    { type: "stretch", time: "17:30", message: "זמן למתיחות", enabled: true }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let scheduleData = await DaySchedule.filter({ date: new Date().toISOString().split('T')[0] });
      if (!scheduleData || scheduleData.length === 0) {
        scheduleData = await DaySchedule.create({ 
          date: new Date().toISOString().split('T')[0],
          morning_prep_start: "06:00",
          work_start: "08:15",
          work_end: "16:15",
          personal_time_start: "20:30",
          meal_times: mealReminders,
          break_reminders: breakReminders
        });
      } else {
        scheduleData = scheduleData[0];
        if (scheduleData.meal_times) setMealReminders(scheduleData.meal_times);
        if (scheduleData.break_reminders) setBreakReminders(scheduleData.break_reminders);
      }
      setSchedule(scheduleData);
      
      const recommendations = await WeeklyRecommendation.list('-week_start_date', 1);
      if (recommendations.length > 0) {
        setRecommendation(recommendations[0]);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setIsLoading(false);
  };

  const handleScheduleChange = (field, value) => {
    setSchedule(prev => ({ ...prev, [field]: value }));
  };

  const saveSchedule = async () => {
    if (!schedule || !schedule.id) return;
    const updatedSchedule = {
      ...schedule,
      meal_times: mealReminders,
      break_reminders: breakReminders
    };
    await DaySchedule.update(schedule.id, updatedSchedule);
    alert('הגדרות נשמרו!');
  };

  const addMealReminder = () => {
    setMealReminders([...mealReminders, { name: "", time: "12:00", enabled: true }]);
  };

  const updateMealReminder = (index, field, value) => {
    const updated = [...mealReminders];
    updated[index][field] = value;
    setMealReminders(updated);
  };

  const removeMealReminder = (index) => {
    setMealReminders(mealReminders.filter((_, i) => i !== index));
  };

  if (isLoading || !schedule) {
    return <div>טוען הגדרות...</div>;
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-neutral-dark">מרכז תכנון והגדרות</h1>
        <p className="text-xl text-neutral-medium mt-2">נהל את סדר היום שלך וקבל תובנות לשיפור היעילות.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Schedule Card */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3"><Clock className="w-6 h-6 text-primary-green" />תכנון סדר יום</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <TimeInput icon={Sun} label="התארגנות בוקר" value={schedule.morning_prep_start} onChange={e => handleScheduleChange('morning_prep_start', e.target.value)} />
                <TimeInput icon={Coffee} label="תחילת עבודה" value={schedule.work_start} onChange={e => handleScheduleChange('work_start', e.target.value)} />
                <TimeInput icon={Clock} label="סיום עבודה" value={schedule.work_end} onChange={e => handleScheduleChange('work_end', e.target.value)} />
                <TimeInput icon={Moon} label="זמן אישי" value={schedule.personal_time_start} onChange={e => handleScheduleChange('personal_time_start', e.target.value)} />
              </div>
              <Button onClick={saveSchedule} className="w-full bg-primary-green hover:bg-primary-dark">
                <Save className="w-4 h-4 ml-2" /> שמור שינויים
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recommendations Card */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-primary-light to-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3"><Lightbulb className="w-6 h-6 text-primary-dark" />המלצות השבוע</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendation ? (
                recommendation.recommendations.map((rec, index) => (
                  <div key={index} className="bg-white/50 p-3 rounded-lg">
                    <p className="font-semibold text-primary-dark">{rec.title}</p>
                    <p className="text-neutral-dark text-sm">{rec.message}</p>
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/50 p-3 rounded-lg">
                    <p className="font-semibold text-primary-dark">תכנן זמן ריכוז</p>
                    <p className="text-neutral-dark text-sm">הקדש 2-3 שעות רצופות למשימות חשובות</p>
                  </div>
                  <div className="bg-white/50 p-3 rounded-lg">
                    <p className="font-semibold text-primary-dark">סיכום יומי</p>
                    <p className="text-neutral-dark text-sm">כל ערב בדוק מה הושג ומה נשאר ליום הבא</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* תזכורות ארוחות */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-6 h-6 text-status-warning" />
                תזכורות ארוחות
              </div>
              <Button onClick={addMealReminder} size="sm">
                <Plus className="w-4 h-4 ml-1" />
                הוסף ארוחה
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mealReminders.map((meal, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                <Switch
                  checked={meal.enabled}
                  onCheckedChange={(checked) => updateMealReminder(index, 'enabled', checked)}
                />
                <Input
                  placeholder="שם הארוחה"
                  value={meal.name}
                  onChange={(e) => updateMealReminder(index, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={meal.time}
                  onChange={(e) => updateMealReminder(index, 'time', e.target.value)}
                  className="w-32"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => removeMealReminder(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* תזכורות הפסקות */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-status-success" />
              תזכורות הפסקות ובריאות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {breakReminders.map((reminder, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                <Switch
                  checked={reminder.enabled}
                  onCheckedChange={(checked) => {
                    const updated = [...breakReminders];
                    updated[index].enabled = checked;
                    setBreakReminders(updated);
                  }}
                />
                <Input
                  type="time"
                  value={reminder.time}
                  onChange={(e) => {
                    const updated = [...breakReminders];
                    updated[index].time = e.target.value;
                    setBreakReminders(updated);
                  }}
                  className="w-32"
                />
                <Input
                  placeholder="הודעת התזכורת"
                  value={reminder.message}
                  onChange={(e) => {
                    const updated = [...breakReminders];
                    updated[index].message = e.target.value;
                    setBreakReminders(updated);
                  }}
                  className="flex-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

const TimeInput = ({ icon: Icon, label, value, onChange }) => (
    <div className="space-y-2">
        <Label className="flex items-center gap-2 text-neutral-dark font-medium"><Icon className="w-4 h-4"/>{label}</Label>
        <Input type="time" value={value || ''} onChange={onChange} className="bg-neutral-bg"/>
    </div>
);