import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DaySchedule, WeeklyRecommendation, SystemConfig } from '@/api/entities';
import {
  Clock, Sun, Moon, Coffee, Save, Lightbulb, Bell, CheckCircle,
  Plus, X, Download, Upload, Database, Cloud, AlertTriangle,
  Settings, Trash2, Server, Pencil, Briefcase, Heart,
  Monitor, FileText, CalendarClock, BarChart3, Users, Tag
} from 'lucide-react';
import { exportAllData, importAllData } from '@/api/base44Client';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import { loadPlatformConfig, savePlatformConfig, DEFAULT_PLATFORMS } from '@/config/platformConfig';

// =====================================================
// MAIN SETTINGS PAGE - Tabbed UI
// =====================================================

const TABS = [
  { key: 'litay', label: 'LitayHub - עבודה', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', activeBg: 'bg-blue-600 text-white' },
  { key: 'lena', label: 'LENA - אישי', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200', activeBg: 'bg-pink-600 text-white' },
  { key: 'system', label: 'מערכת', icon: Monitor, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', activeBg: 'bg-gray-700 text-white' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('litay');

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-full">
          <Settings className="w-8 h-8 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">הגדרות ופרמטרים</h1>
          <p className="text-sm text-gray-500">הגדרות עבודה, אישיות ומערכת - מחולקות לפי פרופיל</p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${
                isActive ? tab.activeBg + ' border-transparent shadow-md' : tab.bg + ' hover:shadow-sm'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'litay' && <LitaySettings />}
        {activeTab === 'lena' && <LenaSettings />}
        {activeTab === 'system' && <SystemSettings />}
      </motion.div>
    </div>
  );
}

// =====================================================
// LITAY TAB - Work Parameters
// =====================================================

const LITAY_PARAM_GROUPS = [
  {
    key: 'service_types',
    label: 'סוגי שירותים',
    icon: Tag,
    color: 'border-blue-200 bg-blue-50/50',
    iconColor: 'text-blue-600',
    placeholder: 'הוסף סוג שירות...',
    description: 'שירותים שניתן לשייך ללקוח בכרטיס לקוח',
  },
  {
    key: 'report_types',
    label: 'סוגי דיווח',
    icon: FileText,
    color: 'border-purple-200 bg-purple-50/50',
    iconColor: 'text-purple-600',
    placeholder: 'הוסף סוג דיווח...',
    description: 'סוגי דוחות ודיווחים תקופתיים',
  },
  {
    key: 'reporting_frequencies',
    label: 'תדירויות דיווח',
    icon: CalendarClock,
    color: 'border-amber-200 bg-amber-50/50',
    iconColor: 'text-amber-600',
    placeholder: 'הוסף תדירות...',
    description: 'אפשרויות תדירות (חודשי, דו-חודשי וכו\')',
  },
  {
    key: 'balance_processes',
    label: 'שלבי מאזן',
    icon: BarChart3,
    color: 'border-emerald-200 bg-emerald-50/50',
    iconColor: 'text-emerald-600',
    placeholder: 'הוסף שלב...',
    description: 'שלבי תהליך הכנת מאזן שנתי',
  },
];

function LitaySettings() {
  const [params, setParams] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [configId, setConfigId] = useState(null);
  const [newValues, setNewValues] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => { loadParams(); }, []);

  const loadParams = async () => {
    setIsLoading(true);
    try {
      const configs = await SystemConfig.list(null, 10);
      const config = configs.find(c => c.config_key === 'system_parameters');
      if (config) {
        setParams(config.data || {});
        setConfigId(config.id);
      } else {
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
      if (configId) await SystemConfig.update(configId, { data: updatedParams });
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
    await saveParams({ ...params, [category]: [...current, value] });
    setNewValues(prev => ({ ...prev, [category]: '' }));
  };

  const removeItem = async (category, index) => {
    const current = [...(params[category] || [])];
    current.splice(index, 1);
    await saveParams({ ...params, [category]: current });
  };

  if (isLoading) return <div className="text-center py-8 text-gray-400">טוען הגדרות עבודה...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Briefcase className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-800">פרמטרים עסקיים - LitayHub</h2>
        {saveStatus === 'saved' && (
          <Badge className="bg-green-100 text-green-700 text-xs mr-auto">
            <CheckCircle className="w-3 h-3 ml-1" /> נשמר
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {LITAY_PARAM_GROUPS.map(group => {
          const Icon = group.icon;
          return (
            <Card key={group.key} className={`border ${group.color} overflow-hidden`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${group.iconColor}`} />
                  {group.label}
                  <Badge variant="outline" className="text-[10px] mr-auto">
                    {(params[group.key] || []).length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-gray-400">{group.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(params[group.key] || []).map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-full text-xs border shadow-sm group hover:shadow-md transition-shadow">
                      {item}
                      <button onClick={() => removeItem(group.key, idx)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newValues[group.key] || ''}
                    onChange={(e) => setNewValues(prev => ({ ...prev, [group.key]: e.target.value }))}
                    placeholder={group.placeholder}
                    className="flex-1 text-sm h-8"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(group.key); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem(group.key)} className="h-8 w-8 p-0">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// LENA TAB - Personal Settings
// =====================================================

function LenaSettings() {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('calmplan_display_name') || 'לנה');
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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let scheduleData = await DaySchedule.filter({ date: new Date().toISOString().split('T')[0] });
      if (!scheduleData || scheduleData.length === 0) {
        scheduleData = await DaySchedule.create({
          date: new Date().toISOString().split('T')[0],
          morning_prep_start: "06:00", work_start: "08:15", work_end: "16:15",
          personal_time_start: "20:30", meal_times: mealReminders, break_reminders: breakReminders,
        });
      } else {
        scheduleData = scheduleData[0];
        if (scheduleData.meal_times) setMealReminders(scheduleData.meal_times);
        if (scheduleData.break_reminders) setBreakReminders(scheduleData.break_reminders);
      }
      setSchedule(scheduleData);
      const recommendations = await WeeklyRecommendation.list('-week_start_date', 1);
      if (recommendations.length > 0) setRecommendation(recommendations[0]);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setIsLoading(false);
  };

  const handleScheduleChange = (field, value) => setSchedule(prev => ({ ...prev, [field]: value }));

  const saveSchedule = async () => {
    if (!schedule?.id) return;
    await DaySchedule.update(schedule.id, { ...schedule, meal_times: mealReminders, break_reminders: breakReminders });
    alert('הגדרות נשמרו!');
  };

  const addMealReminder = () => setMealReminders([...mealReminders, { name: "", time: "12:00", enabled: true }]);
  const updateMealReminder = (index, field, value) => {
    const updated = [...mealReminders];
    updated[index][field] = value;
    setMealReminders(updated);
  };
  const removeMealReminder = (index) => setMealReminders(mealReminders.filter((_, i) => i !== index));

  if (isLoading || !schedule) return <div className="text-center py-8 text-gray-400">טוען הגדרות אישיות...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-5 h-5 text-pink-600" />
        <h2 className="text-lg font-bold text-gray-800">הגדרות אישיות - LENA</h2>
      </div>

      {/* Display Name */}
      <Card className="border-pink-200 bg-pink-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">שם תצוגה</Label>
            <Input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                localStorage.setItem('calmplan_display_name', e.target.value);
              }}
              placeholder="הכנס את השם שלך..."
              className="flex-1 h-9 text-sm max-w-[200px]"
            />
            <span className="text-xs text-gray-400">שם זה יוצג בברכה בדף הבית</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Schedule */}
        <Card className="border-pink-200 bg-pink-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-pink-600" />
              סדר יום
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1 text-gray-500"><Sun className="w-3 h-3" /> התארגנות בוקר</Label>
                <Input type="time" value={schedule.morning_prep_start || ''} onChange={e => handleScheduleChange('morning_prep_start', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1 text-gray-500"><Coffee className="w-3 h-3" /> תחילת עבודה</Label>
                <Input type="time" value={schedule.work_start || ''} onChange={e => handleScheduleChange('work_start', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1 text-gray-500"><Clock className="w-3 h-3" /> סיום עבודה</Label>
                <Input type="time" value={schedule.work_end || ''} onChange={e => handleScheduleChange('work_end', e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1 text-gray-500"><Moon className="w-3 h-3" /> זמן אישי</Label>
                <Input type="time" value={schedule.personal_time_start || ''} onChange={e => handleScheduleChange('personal_time_start', e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <Button onClick={saveSchedule} size="sm" className="w-full bg-pink-600 hover:bg-pink-700">
              <Save className="w-3.5 h-3.5 ml-1" /> שמור שינויים
            </Button>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              המלצות השבוע
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendation ? (
              recommendation.recommendations?.map((rec, index) => (
                <div key={index} className="bg-white/60 p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">{rec.title}</p>
                  <p className="text-xs text-gray-600">{rec.message}</p>
                </div>
              ))
            ) : (
              <>
                <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">תכנן זמן ריכוז</p>
                  <p className="text-xs text-gray-600">הקדש 2-3 שעות רצופות למשימות חשובות</p>
                </div>
                <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">סיכום יומי</p>
                  <p className="text-xs text-gray-600">כל ערב בדוק מה הושג ומה נשאר ליום הבא</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Meal reminders */}
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-600" />
                תזכורות ארוחות
              </div>
              <Button onClick={addMealReminder} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> הוסף
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mealReminders.map((meal, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-orange-100">
                <Switch checked={meal.enabled} onCheckedChange={(checked) => updateMealReminder(index, 'enabled', checked)} />
                <Input placeholder="שם" value={meal.name} onChange={(e) => updateMealReminder(index, 'name', e.target.value)} className="flex-1 h-7 text-xs" />
                <Input type="time" value={meal.time} onChange={(e) => updateMealReminder(index, 'time', e.target.value)} className="w-24 h-7 text-xs" />
                <button onClick={() => removeMealReminder(index)} className="text-gray-300 hover:text-red-500 p-1"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Break reminders */}
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              תזכורות הפסקות ובריאות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {breakReminders.map((reminder, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-100">
                <Switch
                  checked={reminder.enabled}
                  onCheckedChange={(checked) => {
                    const updated = [...breakReminders];
                    updated[index].enabled = checked;
                    setBreakReminders(updated);
                  }}
                />
                <Input type="time" value={reminder.time}
                  onChange={(e) => { const updated = [...breakReminders]; updated[index].time = e.target.value; setBreakReminders(updated); }}
                  className="w-24 h-7 text-xs"
                />
                <Input placeholder="הודעת תזכורת" value={reminder.message}
                  onChange={(e) => { const updated = [...breakReminders]; updated[index].message = e.target.value; setBreakReminders(updated); }}
                  className="flex-1 h-7 text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =====================================================
// SYSTEM TAB - Platforms & Backup
// =====================================================

function SystemSettings() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Monitor className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-bold text-gray-800">הגדרות מערכת</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <PlatformManagementSection />
        <DataBackupSection />
      </div>
    </div>
  );
}

// =====================================================
// PLATFORM MANAGEMENT (kept from original, simplified)
// =====================================================

function PlatformManagementSection() {
  const [platforms, setPlatforms] = useState([]);
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [newField, setNewField] = useState({ key: '', label: '', placeholder: '', type: 'text' });

  useEffect(() => { loadPlatforms(); }, []);

  const loadPlatforms = async () => {
    setIsLoading(true);
    try {
      const { platforms: loaded, configId: id } = await loadPlatformConfig();
      setPlatforms(loaded);
      setConfigId(id);
    } catch (e) { console.error('Error loading platforms:', e); }
    setIsLoading(false);
  };

  const handleSave = async (updatedPlatforms) => {
    try {
      const newId = await savePlatformConfig(configId, updatedPlatforms);
      if (newId) setConfigId(newId);
      setPlatforms(updatedPlatforms);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus(null), 3000); }
  };

  const togglePlatform = async (platId) => {
    const updated = platforms.map(p => p.id === platId ? { ...p, enabled: !p.enabled } : p);
    await handleSave(updated);
  };

  const deletePlatform = async (platId) => {
    if (!window.confirm('למחוק את הפלטפורמה?')) return;
    await handleSave(platforms.filter(p => p.id !== platId));
  };

  const addNewPlatform = () => {
    setEditingPlatform({ id: `platform_${Date.now()}`, name: '', icon: 'server', color: 'bg-blue-500 text-white', enabled: true, fields: [], isNew: true });
  };

  const saveEditingPlatform = async () => {
    if (!editingPlatform?.name.trim()) return;
    const { isNew, ...platData } = editingPlatform;
    const updated = isNew ? [...platforms, platData] : platforms.map(p => p.id === platData.id ? platData : p);
    await handleSave(updated);
    setEditingPlatform(null);
  };

  const addFieldToEditing = () => {
    if (!newField.key.trim() || !newField.label.trim()) return;
    setEditingPlatform(prev => ({ ...prev, fields: [...prev.fields, { ...newField }] }));
    setNewField({ key: '', label: '', placeholder: '', type: 'text' });
  };

  const removeFieldFromEditing = (idx) => setEditingPlatform(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));

  const ICON_OPTIONS = [
    { value: 'server', label: 'Server' }, { value: 'bar-chart', label: 'Chart' },
    { value: 'globe', label: 'Globe' }, { value: 'hard-drive', label: 'HardDrive' },
  ];
  const COLOR_OPTIONS = [
    { value: 'bg-black text-white', label: 'שחור' }, { value: 'bg-blue-500 text-white', label: 'כחול' },
    { value: 'bg-green-500 text-white', label: 'ירוק' }, { value: 'bg-purple-600 text-white', label: 'סגול' },
    { value: 'bg-orange-500 text-white', label: 'כתום' }, { value: 'bg-gray-600 text-white', label: 'אפור' },
  ];

  if (isLoading) return <div className="text-center py-4 text-gray-400">טוען פלטפורמות...</div>;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            פלטפורמות פרויקטים
            {saveStatus === 'saved' && <Badge className="bg-green-100 text-green-700 text-[10px]">נשמר</Badge>}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSave([...DEFAULT_PLATFORMS])}>איפוס</Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={addNewPlatform}><Plus className="w-3 h-3" /> חדשה</Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {platforms.map(plat => (
          <div key={plat.id} className={`flex items-center gap-2 p-2 rounded-lg border ${plat.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
            <Switch checked={plat.enabled} onCheckedChange={() => togglePlatform(plat.id)} />
            <Badge className={`${plat.color} text-[10px]`}>{plat.name}</Badge>
            <span className="text-[10px] text-gray-400 flex-1">{plat.fields.length} שדות</span>
            <button onClick={() => setEditingPlatform({ ...plat })} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
            <button onClick={() => deletePlatform(plat.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}

        {editingPlatform && (
          <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50 space-y-3 mt-2">
            <h4 className="font-semibold text-sm">{editingPlatform.isNew ? 'פלטפורמה חדשה' : `עריכה: ${editingPlatform.name}`}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><Label className="text-[10px]">שם</Label><Input value={editingPlatform.name} onChange={e => setEditingPlatform(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" /></div>
              <div><Label className="text-[10px]">אייקון</Label>
                <select value={editingPlatform.icon} onChange={e => setEditingPlatform(p => ({ ...p, icon: e.target.value }))} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div><Label className="text-[10px]">צבע</Label>
                <select value={editingPlatform.color} onChange={e => setEditingPlatform(p => ({ ...p, color: e.target.value }))} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  {COLOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="flex items-end"><Badge className={`${editingPlatform.color} px-3 py-1`}>{editingPlatform.name || '...'}</Badge></div>
            </div>
            <div>
              <Label className="text-[10px] font-semibold">שדות</Label>
              <div className="space-y-1 mt-1">
                {editingPlatform.fields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border">
                    <span className="font-mono text-[10px] text-gray-500 w-24 truncate">{field.key}</span>
                    <span className="flex-1">{field.label}</span>
                    <button onClick={() => removeFieldFromEditing(idx)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                <Input value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value.replace(/\s/g, '_') }))} placeholder="key" className="text-[10px] h-7" dir="ltr" />
                <Input value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="תווית" className="text-[10px] h-7" />
                <Input value={newField.placeholder} onChange={e => setNewField(p => ({ ...p, placeholder: e.target.value }))} placeholder="placeholder" className="text-[10px] h-7" dir="ltr" />
                <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))} className="border rounded-md px-1 text-[10px]">
                  <option value="text">טקסט</option><option value="url">URL</option>
                </select>
                <Button variant="outline" size="sm" onClick={addFieldToEditing} disabled={!newField.key || !newField.label} className="h-7 p-0"><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingPlatform(null)}>ביטול</Button>
              <Button size="sm" className="h-7 text-xs" onClick={saveEditingPlatform} disabled={!editingPlatform.name.trim()}>שמור</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// DATA BACKUP
// =====================================================

function DataBackupSection() {
  const [backupStatus, setBackupStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('calmplan_auto_backup') === 'true');
  const [lastAutoBackup, setLastAutoBackup] = useState(() => localStorage.getItem('calmplan_last_auto_backup'));
  const fileInputRef = useRef(null);

  // Auto-backup: save snapshot to localStorage every 2 hours
  useEffect(() => {
    if (!autoBackupEnabled) return;
    const runAutoBackup = async () => {
      try {
        const data = await exportAllData();
        const snapshot = JSON.stringify(data);
        localStorage.setItem('calmplan_auto_backup_data', snapshot);
        const now = new Date().toISOString();
        localStorage.setItem('calmplan_last_auto_backup', now);
        setLastAutoBackup(now);
      } catch (e) {
        console.error('Auto-backup failed:', e);
      }
    };
    // Run immediately on enable
    runAutoBackup();
    // Then every 2 hours
    const interval = setInterval(runAutoBackup, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoBackupEnabled]);

  const toggleAutoBackup = (enabled) => {
    setAutoBackupEnabled(enabled);
    localStorage.setItem('calmplan_auto_backup', enabled ? 'true' : 'false');
  };

  const downloadAutoBackup = () => {
    const data = localStorage.getItem('calmplan_auto_backup_data');
    if (!data) { setBackupStatus({ type: 'error', message: 'אין גיבוי אוטומטי זמין' }); return; }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calmplan_auto_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus({ type: 'success', message: 'גיבוי אוטומטי הורד!' });
  };

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
      setMigrationResult({ type: 'success', message: `הועברו ${result.migrated} אוספים, דולגו ${result.skipped}, שגיאות ${result.errors}`, details: result.collections });
    } catch (e) {
      setMigrationResult({ type: 'error', message: 'שגיאה במיגרציה: ' + e.message });
    }
    setIsMigrating(false);
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          גיבוי ושחזור נתונים
          <Badge variant={isSupabaseConfigured ? "default" : "outline"} className={`text-[10px] mr-auto ${isSupabaseConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {isSupabaseConfigured ? <><Cloud className="w-3 h-3 ml-1" /> Supabase</> : <><AlertTriangle className="w-3 h-3 ml-1" /> localStorage</>}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSupabaseConfigured && (
          <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            הנתונים נשמרים רק בדפדפן. מחיקת cookies תמחק הכל. מומלץ לגבות.
          </div>
        )}

        {/* Auto-backup */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">גיבוי אוטומטי</span>
            </div>
            <Switch checked={autoBackupEnabled} onCheckedChange={toggleAutoBackup} />
          </div>
          {autoBackupEnabled && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-600">
                {lastAutoBackup
                  ? `גיבוי אחרון: ${new Date(lastAutoBackup).toLocaleString('he-IL')}`
                  : 'טרם בוצע גיבוי'}
              </span>
              <Button onClick={downloadAutoBackup} variant="outline" size="sm" className="h-6 text-[10px] border-blue-300 text-blue-700">
                <Download className="w-3 h-3 ml-1" /> הורד גיבוי אוטומטי
              </Button>
            </div>
          )}
          <p className="text-[10px] text-blue-600/70">שומר snapshot כל 2 שעות בדפדפן. מומלץ להפעיל תמיד.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} disabled={isExporting} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1">
            <Download className="w-3.5 h-3.5" /> {isExporting ? 'מייצא...' : 'ייצוא גיבוי'}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} variant="outline" size="sm" className="h-8 text-xs gap-1">
            <Upload className="w-3.5 h-3.5" /> {isImporting ? 'מייבא...' : 'ייבוא מגיבוי'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          {isSupabaseConfigured && (
            <Button onClick={handleMigrateToSupabase} disabled={isMigrating} variant="outline" size="sm" className="bg-green-50 border-green-200 text-green-700 h-8 text-xs gap-1">
              <Cloud className="w-3.5 h-3.5" /> {isMigrating ? 'מעביר...' : 'העבר ל-Supabase'}
            </Button>
          )}
        </div>
        {backupStatus && (
          <div className={`p-2 rounded-lg text-xs ${backupStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {backupStatus.message}
          </div>
        )}
        {migrationResult && (
          <div className={`p-2 rounded-lg text-xs ${migrationResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <p className="font-medium">{migrationResult.message}</p>
            {migrationResult.details && (
              <ul className="mt-1 space-y-0.5">
                {migrationResult.details.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className={c.status === 'migrated' ? 'text-green-600' : c.status === 'skipped' ? 'text-gray-500' : 'text-red-600'}>
                      {c.status === 'migrated' ? '✓' : c.status === 'skipped' ? '−' : '✗'}
                    </span>
                    {c.name} {c.count ? `(${c.count})` : ''} {c.reason || ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
