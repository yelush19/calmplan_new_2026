import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DaySchedule, WeeklyRecommendation, SystemConfig } from '@/api/entities';
import { Clock, Sun, Moon, Coffee, Save, Lightbulb, Bell, CheckCircle, Plus, X, Download, Upload, Database, Cloud, AlertTriangle, Settings, Trash2, Server, Pencil } from 'lucide-react';
import { exportAllData, importAllData } from '@/api/base44Client';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import { loadPlatformConfig, savePlatformConfig, DEFAULT_PLATFORMS } from '@/config/platformConfig';

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

      {/* הגדרות פרמטרים */}
      <SystemParametersSection />

      {/* ניהול פלטפורמות */}
      <PlatformManagementSection />

      {/* גיבוי ושחזור נתונים */}
      <DataBackupSection />
    </div>
  );
}

const PARAM_CATEGORIES = [
  { key: 'service_types', label: 'סוגי שירותים', placeholder: 'הוסף סוג שירות חדש...', description: 'שירותים שניתן לשייך ללקוח' },
  { key: 'report_types', label: 'סוגי דיווח', placeholder: 'הוסף סוג דיווח...', description: 'סוגי דוחות ודיווחים' },
  { key: 'reporting_frequencies', label: 'תדירויות דיווח', placeholder: 'הוסף תדירות...', description: 'אפשרויות תדירות (חודשי, דו-חודשי וכו\')' },
  { key: 'balance_processes', label: 'תהליכי מאזן', placeholder: 'הוסף שלב תהליך...', description: 'שלבי הכנת מאזן שנתי' },
];

function SystemParametersSection() {
  const [params, setParams] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [configId, setConfigId] = useState(null);
  const [newValues, setNewValues] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadParams();
  }, []);

  const loadParams = async () => {
    setIsLoading(true);
    try {
      const configs = await SystemConfig.list(null, 10);
      const config = configs.find(c => c.config_key === 'system_parameters');
      if (config) {
        setParams(config.data || {});
        setConfigId(config.id);
      } else {
        // Initialize with defaults
        const defaults = {
          service_types: ['הנהלת חשבונות', 'דיווחי מע"מ', 'מקדמות מס', 'שכר', 'ביטוח לאומי', 'מ"ה ניכויים', 'מס"ב עובדים', 'מס"ב סוציאליות', 'מס"ב ספקים', 'תשלום רשויות', 'דוחות רווח והפסד', 'מאזנים / דוחות שנתיים', 'התאמות חשבונות', 'דיווח למתפעל', 'דיווח לטמל', 'משלוח תלושים', 'תביעות מילואים', 'ייעוץ', 'אדמיניסטרציה'],
          report_types: ['מע"מ תקופתי', '874 מפורט', 'מקדמות מס הכנסה', 'ביטוח לאומי', 'ניכויים', 'דוח שנתי'],
          reporting_frequencies: ['חודשי', 'דו-חודשי', 'רבעוני', 'חצי שנתי', 'שנתי', 'לא רלוונטי'],
          balance_processes: ['פעולות סגירה', 'עריכה לביקורת', 'שליחה לרו"ח', 'שאלות רו"ח - סבב 1', 'שאלות רו"ח - סבב 2', 'חתימה'],
        };
        const newConfig = await SystemConfig.create({ config_key: 'system_parameters', data: defaults });
        setParams(defaults);
        setConfigId(newConfig.id);
      }
    } catch (e) {
      console.error('Error loading system params:', e);
    }
    setIsLoading(false);
  };

  const saveParams = async (updatedParams) => {
    try {
      if (configId) {
        await SystemConfig.update(configId, { data: updatedParams });
      }
      setParams(updatedParams);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      console.error('Error saving params:', e);
      setSaveStatus('error');
    }
  };

  const addItem = async (category) => {
    const value = (newValues[category] || '').trim();
    if (!value) return;
    const current = params[category] || [];
    if (current.includes(value)) return;
    const updated = { ...params, [category]: [...current, value] };
    await saveParams(updated);
    setNewValues(prev => ({ ...prev, [category]: '' }));
  };

  const removeItem = async (category, index) => {
    const current = [...(params[category] || [])];
    current.splice(index, 1);
    await saveParams({ ...params, [category]: current });
  };

  if (isLoading) return <div className="text-center py-4 text-gray-500">טוען הגדרות פרמטרים...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-purple-600" />
            הגדרות פרמטרים
            {saveStatus === 'saved' && <span className="text-sm font-normal text-green-600 mr-auto">נשמר!</span>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">הוסף וערוך סוגי שירותים, דיווחים, תדירויות ותהליכי מאזן. השינויים נשמרים אוטומטית.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {PARAM_CATEGORIES.map(cat => (
            <div key={cat.key} className="border rounded-lg p-4 space-y-3">
              <div>
                <Label className="font-bold text-base">{cat.label}</Label>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(params[cat.key] || []).map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm group">
                    {item}
                    <button onClick={() => removeItem(cat.key, idx)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newValues[cat.key] || ''}
                  onChange={(e) => setNewValues(prev => ({ ...prev, [cat.key]: e.target.value }))}
                  placeholder={cat.placeholder}
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(cat.key); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(cat.key)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PlatformManagementSection() {
  const [platforms, setPlatforms] = useState([]);
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [newField, setNewField] = useState({ key: '', label: '', placeholder: '', type: 'text' });

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    setIsLoading(true);
    try {
      const { platforms: loaded, configId: id } = await loadPlatformConfig();
      setPlatforms(loaded);
      setConfigId(id);
    } catch (e) {
      console.error('Error loading platforms:', e);
    }
    setIsLoading(false);
  };

  const handleSave = async (updatedPlatforms) => {
    try {
      const newId = await savePlatformConfig(configId, updatedPlatforms);
      if (newId) setConfigId(newId);
      setPlatforms(updatedPlatforms);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const togglePlatform = async (platId) => {
    const updated = platforms.map(p => p.id === platId ? { ...p, enabled: !p.enabled } : p);
    await handleSave(updated);
  };

  const deletePlatform = async (platId) => {
    if (!window.confirm('למחוק את הפלטפורמה?')) return;
    const updated = platforms.filter(p => p.id !== platId);
    await handleSave(updated);
  };

  const addNewPlatform = () => {
    setEditingPlatform({
      id: `platform_${Date.now()}`,
      name: '',
      icon: 'server',
      color: 'bg-blue-500 text-white',
      enabled: true,
      fields: [],
      isNew: true,
    });
  };

  const saveEditingPlatform = async () => {
    if (!editingPlatform || !editingPlatform.name.trim()) return;
    const { isNew, ...platData } = editingPlatform;
    let updated;
    if (isNew) {
      updated = [...platforms, platData];
    } else {
      updated = platforms.map(p => p.id === platData.id ? platData : p);
    }
    await handleSave(updated);
    setEditingPlatform(null);
  };

  const addFieldToEditing = () => {
    if (!newField.key.trim() || !newField.label.trim()) return;
    setEditingPlatform(prev => ({
      ...prev,
      fields: [...prev.fields, { ...newField }],
    }));
    setNewField({ key: '', label: '', placeholder: '', type: 'text' });
  };

  const removeFieldFromEditing = (idx) => {
    setEditingPlatform(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }));
  };

  const resetToDefaults = async () => {
    if (!window.confirm('לאפס לברירת מחדל? פלטפורמות מותאמות יימחקו.')) return;
    await handleSave([...DEFAULT_PLATFORMS]);
  };

  const ICON_OPTIONS = [
    { value: 'server', label: 'Server' },
    { value: 'bar-chart', label: 'Chart' },
    { value: 'globe', label: 'Globe' },
    { value: 'hard-drive', label: 'HardDrive' },
    { value: 'train-front', label: 'Train' },
  ];

  const COLOR_OPTIONS = [
    { value: 'bg-black text-white', label: 'שחור' },
    { value: 'bg-red-500 text-white', label: 'אדום' },
    { value: 'bg-blue-500 text-white', label: 'כחול' },
    { value: 'bg-green-500 text-white', label: 'ירוק' },
    { value: 'bg-purple-600 text-white', label: 'סגול' },
    { value: 'bg-teal-500 text-white', label: 'טורקיז' },
    { value: 'bg-orange-500 text-white', label: 'כתום' },
    { value: 'bg-gray-600 text-white', label: 'אפור' },
  ];

  if (isLoading) return <div className="text-center py-4 text-gray-500">טוען פלטפורמות...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.47 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-6 h-6 text-blue-600" />
              פלטפורמות פרויקטים
              {saveStatus === 'saved' && <span className="text-sm font-normal text-green-600">נשמר!</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>איפוס</Button>
              <Button size="sm" onClick={addNewPlatform}><Plus className="w-4 h-4 ml-1" /> פלטפורמה חדשה</Button>
            </div>
          </CardTitle>
          <p className="text-sm text-muted-foreground">הגדר פלטפורמות הרצה (Vercel, Streamlit וכו') עם שדות מותאמים אישית לכל אחת</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {platforms.map(plat => (
            <div key={plat.id} className={`flex items-center gap-3 p-3 rounded-lg border ${plat.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
              <Switch checked={plat.enabled} onCheckedChange={() => togglePlatform(plat.id)} />
              <Badge className={`${plat.color} text-xs`}>{plat.name}</Badge>
              <span className="text-xs text-gray-500 flex-1">
                {plat.fields.length} שדות: {plat.fields.map(f => f.label).join(', ') || 'ללא'}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setEditingPlatform({ ...plat })}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deletePlatform(plat.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}

          {platforms.length === 0 && (
            <p className="text-center text-gray-400 py-4">אין פלטפורמות. לחצי על "פלטפורמה חדשה" או "איפוס".</p>
          )}

          {/* Edit/Create dialog inline */}
          {editingPlatform && (
            <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 space-y-4 mt-4">
              <h4 className="font-semibold">{editingPlatform.isNew ? 'פלטפורמה חדשה' : `עריכה: ${editingPlatform.name}`}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">שם</Label>
                  <Input value={editingPlatform.name} onChange={e => setEditingPlatform(p => ({ ...p, name: e.target.value }))} placeholder="Vercel" />
                </div>
                <div>
                  <Label className="text-xs">אייקון</Label>
                  <select
                    value={editingPlatform.icon}
                    onChange={e => setEditingPlatform(p => ({ ...p, icon: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">צבע</Label>
                  <select
                    value={editingPlatform.color}
                    onChange={e => setEditingPlatform(p => ({ ...p, color: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {COLOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Badge className={`${editingPlatform.color} px-3 py-1.5`}>{editingPlatform.name || '...'}</Badge>
                </div>
              </div>

              {/* Fields */}
              <div>
                <Label className="text-xs font-semibold">שדות הפלטפורמה</Label>
                <div className="space-y-2 mt-2">
                  {editingPlatform.fields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                      <span className="font-mono text-xs text-gray-500 w-28 truncate">{field.key}</span>
                      <span className="flex-1">{field.label}</span>
                      <Badge variant="outline" className="text-[10px]">{field.type}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => removeFieldFromEditing(idx)} className="text-red-500 h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>

                {/* Add field */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                  <Input value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value.replace(/\s/g, '_') }))} placeholder="מפתח (key)" className="text-xs" dir="ltr" />
                  <Input value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="תווית (label)" className="text-xs" />
                  <Input value={newField.placeholder} onChange={e => setNewField(p => ({ ...p, placeholder: e.target.value }))} placeholder="placeholder" className="text-xs" dir="ltr" />
                  <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))} className="border rounded-md px-2 text-xs">
                    <option value="text">טקסט</option>
                    <option value="url">URL</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={addFieldToEditing} disabled={!newField.key || !newField.label}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingPlatform(null)}>ביטול</Button>
                <Button size="sm" onClick={saveEditingPlatform} disabled={!editingPlatform.name.trim()}>שמור</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DataBackupSection() {
  const [backupStatus, setBackupStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calmplan_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus({ type: 'success', message: 'גיבוי הורד בהצלחה!' });
    } catch (e) {
      setBackupStatus({ type: 'error', message: 'שגיאה בגיבוי: ' + e.message });
    }
    setIsExporting(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      setBackupStatus({ type: 'success', message: 'נתונים שוחזרו בהצלחה! רענן את הדף.' });
    } catch (e) {
      setBackupStatus({ type: 'error', message: 'שגיאה בשחזור: ' + e.message });
    }
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMigrateToSupabase = async () => {
    if (!isSupabaseConfigured) {
      setMigrationResult({ type: 'error', message: 'Supabase לא מוגדר. הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY לקובץ .env' });
      return;
    }
    setIsMigrating(true);
    try {
      const { migrateFromLocalStorage } = await import('@/api/supabaseDB');
      const result = await migrateFromLocalStorage();
      setMigrationResult({
        type: 'success',
        message: `הועברו ${result.migrated} אוספים, דולגו ${result.skipped}, שגיאות ${result.errors}`,
        details: result.collections
      });
    } catch (e) {
      setMigrationResult({ type: 'error', message: 'שגיאה במיגרציה: ' + e.message });
    }
    setIsMigrating(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600" />
            גיבוי ושחזור נתונים
            <Badge variant={isSupabaseConfigured ? "default" : "outline"} className={isSupabaseConfigured ? "bg-green-100 text-green-800 mr-auto" : "bg-yellow-100 text-yellow-800 mr-auto"}>
              {isSupabaseConfigured ? (
                <><Cloud className="w-3 h-3 ml-1" /> Supabase מחובר</>
              ) : (
                <><AlertTriangle className="w-3 h-3 ml-1" /> localStorage בלבד</>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupabaseConfigured && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>שים לב:</strong> הנתונים שלך נשמרים רק בדפדפן (localStorage).
              מחיקת cookies או נתוני אתר תמחק הכל.
              מומלץ מאוד לגבות ולהתחבר ל-Supabase.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 ml-2" />
              {isExporting ? 'מייצא...' : 'ייצוא גיבוי (JSON)'}
            </Button>

            <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} variant="outline">
              <Upload className="w-4 h-4 ml-2" />
              {isImporting ? 'מייבא...' : 'ייבוא מגיבוי'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

            {!isSupabaseConfigured ? null : (
              <Button onClick={handleMigrateToSupabase} disabled={isMigrating} variant="outline"
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                <Cloud className="w-4 h-4 ml-2" />
                {isMigrating ? 'מעביר...' : 'העבר מ-localStorage ל-Supabase'}
              </Button>
            )}
          </div>

          {backupStatus && (
            <div className={`p-3 rounded-lg text-sm ${
              backupStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {backupStatus.message}
            </div>
          )}

          {migrationResult && (
            <div className={`p-3 rounded-lg text-sm ${
              migrationResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <p className="font-medium">{migrationResult.message}</p>
              {migrationResult.details && (
                <ul className="mt-2 space-y-1">
                  {migrationResult.details.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={c.status === 'migrated' ? 'text-green-600' : c.status === 'skipped' ? 'text-gray-500' : 'text-red-600'}>
                        {c.status === 'migrated' ? '✓' : c.status === 'skipped' ? '−' : '✗'}
                      </span>
                      {c.name} {c.count ? `(${c.count} רשומות)` : ''} {c.reason || ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const TimeInput = ({ icon: Icon, label, value, onChange }) => (
    <div className="space-y-2">
        <Label className="flex items-center gap-2 text-neutral-dark font-medium"><Icon className="w-4 h-4"/>{label}</Label>
        <Input type="time" value={value || ''} onChange={onChange} className="bg-neutral-bg"/>
    </div>
);