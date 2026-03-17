import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DaySchedule, WeeklyRecommendation, SystemConfig, Task } from '@/api/entities';
import {
  Clock, Sun, Moon, Coffee, Save, Lightbulb, Bell, CheckCircle,
  Plus, X, Download, Upload, Database, Cloud, AlertTriangle, RefreshCw,
  Settings, Trash2, Server, Pencil, Briefcase, Heart, ChevronDown,
  Monitor, FileText, CalendarClock, BarChart3, Users, Tag, Network, Zap, CloudUpload, Loader2
} from 'lucide-react';
import { exportAllData, importAllData } from '@/api/base44Client';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import { loadPlatformConfig, savePlatformConfig, DEFAULT_PLATFORMS } from '@/config/platformConfig';
import { getAutomationLog, clearAutomationLog } from '@/engines/automationEngine';
import ExecutionPeriodSettings from '@/components/settings/ExecutionPeriodSettings';
import SettingsMindMap from '@/components/settings/SettingsMindMap';
import TemplatePanel from '@/components/settings/TemplatePanel';
import ServiceCatalog from '@/components/settings/ServiceCatalog';
import ServiceCatalogSection from '@/components/settings/ServiceCatalogSection';
import ProcessArchitect from '@/components/settings/ProcessArchitect';
import { useDesign } from '@/contexts/DesignContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ExternalLink } from 'lucide-react';
import { ALL_SERVICES, getStepsForService } from '@/config/processTemplates';

// =====================================================
// MAIN SETTINGS PAGE - Tabbed UI + Process Architect
// =====================================================

const TABS = [
  { key: 'architect', label: 'Process Architect', icon: Network, color: 'text-[#6366F1]', bg: 'bg-gradient-to-r from-[#6366F110] to-[#FFC10710] border-[#6366F130]', activeBg: 'bg-gradient-to-r from-[#6366F1] to-[#FFC107] text-white' },
  { key: 'automations', label: 'אוטומציות', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', activeBg: 'bg-purple-600 text-white' },
  { key: 'system', label: 'מערכת', icon: Monitor, color: 'text-[#4682B4]', bg: 'bg-[#4682B408] border-[#4682B430]', activeBg: 'bg-[#4682B4] text-white' },
];

// ── P1-P5 Branch DNA for Settings ──
const P_BRANCHES = [
  { key: 'P1', label: 'P1 | חשבות שכר', color: '#00A3E0', icon: '💰', dashboards: ['payroll'] },
  { key: 'P2', label: 'P2 | הנהלת חשבונות ומיסים', color: '#4682B4', icon: '📊', dashboards: ['tax'] },
  { key: 'P3', label: 'P3 | ניהול ותכנון', color: '#F59E0B', icon: '📋', dashboards: ['admin', 'additional'] },
  { key: 'P4', label: 'P4 | בית ואישי', color: '#FACC15', icon: '🏠', dashboards: ['home'] },
  { key: 'P5', label: 'P5 | דוחות שנתיים', color: '#2E7D32', icon: '📈', dashboards: ['annual_reports'] },
];

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  if (dashboard === 'home') return 'P4';
  if (dashboard === 'annual_reports') return 'P5';
  return 'P3';
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('architect');
  const [selectedService, setSelectedService] = useState(null);

  // ── New category state ──
  const [addingTo, setAddingTo] = useState(null); // branch key (P1, P2, etc.) or null
  const [newCatName, setNewCatName] = useState('');

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // null | 'success' | 'error'
  const [isDirty, setIsDirty] = useState(false);

  // Listen for design engine changes (color/shape from AyoaRadialView)
  useEffect(() => {
    const handler = () => setIsDirty(true);
    window.addEventListener('calmplan:design-changed', handler);
    return () => window.removeEventListener('calmplan:design-changed', handler);
  }, []);

  // ── Custom categories stored in localStorage ──
  const [customCategories, setCustomCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('calmplan_custom_categories') || '{}'); }
    catch { return {}; }
  });

  // Group ALL_SERVICES by P-branch
  const groupedServices = React.useMemo(() => {
    const groups = {};
    for (const branch of P_BRANCHES) groups[branch.key] = [];
    for (const [key, svc] of Object.entries(ALL_SERVICES || {})) {
      const branch = svc.branch || getDashboardBranch(svc.dashboard);
      if (!groups[branch]) groups[branch] = [];
      groups[branch].push({ ...svc, key, _branch: branch });
    }
    // Add custom categories
    for (const [branchKey, cats] of Object.entries(customCategories)) {
      if (!groups[branchKey]) groups[branchKey] = [];
      (cats || []).forEach(cat => {
        groups[branchKey].push({ key: cat.key, label: cat.label, _branch: branchKey, _source: 'custom', steps: [] });
      });
    }
    return groups;
  }, [customCategories]);

  const handleAddCategory = useCallback((branchKey) => {
    if (!newCatName.trim()) return;
    const catKey = `custom_${Date.now()}`;
    const newCat = { key: catKey, label: newCatName.trim() };
    setCustomCategories(prev => {
      const updated = { ...prev, [branchKey]: [...(prev[branchKey] || []), newCat] };
      localStorage.setItem('calmplan_custom_categories', JSON.stringify(updated));
      return updated;
    });
    setNewCatName('');
    setAddingTo(null);
    setIsDirty(true);
    // Auto-select the newly created service for editing in TemplatePanel
    setSelectedService({ key: catKey, label: newCat.label, branch: branchKey, _source: 'custom', steps: [], dashboard: 'admin' });
  }, [newCatName]);

  const handleRemoveCustomCat = useCallback((branchKey, catKey) => {
    setCustomCategories(prev => {
      const updated = { ...prev, [branchKey]: (prev[branchKey] || []).filter(c => c.key !== catKey) };
      localStorage.setItem('calmplan_custom_categories', JSON.stringify(updated));
      return updated;
    });
    setIsDirty(true);
  }, []);

  // ── Global Save: push full DNA structure to Supabase ──
  const handleGlobalSave = useCallback(async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const manifest = {};
      for (const [branchKey, services] of Object.entries(groupedServices)) {
        for (const svc of services) {
          manifest[svc.key] = {
            key: svc.key,
            label: svc.label,
            branch: branchKey,
            dashboard: svc.dashboard,
            taskType: svc.taskType || 'linear',
            _source: svc._source || 'template',
            steps: (svc.steps || []).map((step, i) => ({
              key: step.key,
              label: step.label,
              sort_order: i,
              parent_service: svc.key,
            })),
          };
        }
      }

      const existing = await SystemConfig.list();
      const upsert = async (configKey, data) => {
        const record = existing.find(r => r.config_key === configKey);
        const payload = { config_key: configKey, config_value: data, updated_at: new Date().toISOString() };
        if (record) await SystemConfig.update(record.id, payload);
        else await SystemConfig.create(payload);
      };

      await upsert('service_definitions', manifest);
      await upsert('custom_categories', customCategories);
      await upsert('custom_services', JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}'));
      await upsert('node_positions', JSON.parse(localStorage.getItem('calmplan_node_positions') || '{}'));
      await upsert('last_full_sync', {
        timestamp: new Date().toISOString(),
        total: Object.keys(manifest).length,
        branches: Object.fromEntries(P_BRANCHES.map(b => [b.key, (groupedServices[b.key] || []).length])),
      });

      setSaveResult('success');
      setIsDirty(false);
      setTimeout(() => setSaveResult(null), 3000);
    } catch (err) {
      console.error('[Settings] Global save failed:', err);
      setSaveResult('error');
    }
    setIsSaving(false);
  }, [groupedServices, customCategories]);

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full" style={{ background: 'linear-gradient(135deg, #6366F120, #FFC10720)' }}>
          <Network className="w-8 h-8 text-[#6366F1]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">הגדרות ופרמטרים</h1>
          <p className="text-sm text-gray-500">אדריכל תהליכים מאוחד • P1-P5 • מערכת</p>
        </div>
      </div>

      {/* Tab selector — organic pills */}
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
        {activeTab === 'architect' && (
          <div className="space-y-4">
            {/* MindMap + TemplatePanel */}
            <div className="relative">
              <SettingsMindMap onSelectService={setSelectedService} onConfigChange={() => setIsDirty(true)} />
              {selectedService && (
                <TemplatePanel service={selectedService} onClose={() => setSelectedService(null)} />
              )}
            </div>

            {/* ═══════════════════════════════════════════════════
                PROCESS ARCHITECT — Dynamic tree editor (replaces P1-P5 accordion)
                Full CRUD: branches, nodes, steps. Saved to DB.
                ═══════════════════════════════════════════════════ */}
            <ProcessArchitect />

            {/* Existing sub-panels — Business Params, Personal, Catalog */}
            <Accordion type="multiple" className="w-full space-y-2">
              <AccordionItem value="business" className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-5 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#00A3E0]" />
                    <span className="text-sm font-bold text-gray-800">פרמטרים עסקיים</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  <LitaySettings />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="personal" className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-5 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#FFC107]" />
                    <span className="text-sm font-bold text-gray-800">P4 אישי — סדר יום והפסקות</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  <LenaSettings />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="catalog" className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-5 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-bold text-gray-800">קטלוג שירותים מפורט</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  <ServiceCatalog />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
        {activeTab === 'automations' && <AutomationSettings />}
        {activeTab === 'system' && <SystemSettings />}
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          STICKY GLOBAL SAVE BUTTON — always visible at bottom
          ══════════════════════════════════════════════════════ */}
      {/* STICKY GLOBAL SAVE BUTTON — always visible at bottom of Settings */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm border-t shadow-lg px-6 py-3 transition-all ${isDirty ? 'bg-amber-50/95 ring-2 ring-amber-400 ring-inset' : 'bg-white/95'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge className="bg-amber-100 text-amber-700 text-xs gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> שינויים שלא נשמרו
              </Badge>
            )}
            {saveResult === 'success' && (
              <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                <CheckCircle className="w-3 h-3" /> נשמר בהצלחה
              </Badge>
            )}
            {saveResult === 'error' && (
              <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> שגיאה בשמירה
              </Badge>
            )}
            {!isDirty && !saveResult && (
              <span className="text-xs text-gray-400">אין שינויים לשמירה</span>
            )}
          </div>
          <Button
            onClick={handleGlobalSave}
            disabled={isSaving}
            className={`gap-2 px-8 py-2.5 text-sm font-bold rounded-xl shadow-md ${isDirty ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
            style={{ backgroundColor: isDirty ? '#2E7D32' : '#546E7A', color: 'white' }}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            {isSaving ? 'שומר...' : isDirty ? 'שמור שינויים' : 'שמור שינויים'}
          </Button>
        </div>
      </div>
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
    color: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
    placeholder: 'הוסף סוג שירות...',
    description: 'שירותים שניתן לשייך ללקוח בכרטיס לקוח',
  },
  {
    key: 'report_types',
    label: 'סוגי דיווח',
    icon: FileText,
    color: 'border-purple-200 bg-purple-50',
    iconColor: 'text-purple-600',
    placeholder: 'הוסף סוג דיווח...',
    description: 'סוגי דוחות ודיווחים תקופתיים',
  },
  {
    key: 'reporting_frequencies',
    label: 'תדירויות דיווח',
    icon: CalendarClock,
    color: 'border-amber-200 bg-amber-50',
    iconColor: 'text-amber-600',
    placeholder: 'הוסף תדירות...',
    description: 'אפשרויות תדירות (חודשי, דו-חודשי וכו\')',
  },
  {
    key: 'balance_processes',
    label: 'שלבי מאזן',
    icon: BarChart3,
    color: 'border-emerald-200 bg-emerald-50',
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
          report_types: ['מע"מ תקופתי', '874 מפורט', 'מקדמות מס הכנסה', 'ביטוח לאומי — דיווח', 'ניכויים — דיווח', 'דוח שנתי'],
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
        <Briefcase className="w-5 h-5 text-[#00A3E0]" />
        <h2 className="text-lg font-bold text-gray-800">פרמטרים עסקיים</h2>
        <span className="text-xs text-gray-400">סוגי שירותים, תדירויות, שלבי מאזן</span>
        {saveStatus === 'saved' && (
          <Badge className="bg-green-100 text-green-700 text-xs mr-auto">
            <CheckCircle className="w-3 h-3 ms-1" /> נשמר
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
                  <Badge variant="outline" className="text-[12px] mr-auto">
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
                      <button onClick={() => removeItem(group.key, idx)} className="text-gray-300 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100">
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

      {/* Execution Period Templates */}
      <ExecutionPeriodSettings />
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
      const recommendations = await WeeklyRecommendation.list(null, 1);
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
        <Heart className="w-5 h-5 text-[#FFC107]" />
        <h2 className="text-lg font-bold text-gray-800">P4 | הגדרות אישיות</h2>
        <span className="text-xs text-gray-400">סדר יום, ארוחות, הפסקות</span>
      </div>

      {/* Display Name */}
      <Card className="border-amber-200 bg-amber-50">
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
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
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
            <Button onClick={saveSchedule} size="sm" className="w-full bg-amber-600 hover:bg-amber-700">
              <Save className="w-3.5 h-3.5 ms-1" /> שמור שינויים
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
                <div key={index} className="bg-white p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">{rec.title}</p>
                  <p className="text-xs text-gray-600">{rec.message}</p>
                </div>
              ))
            ) : (
              <>
                <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">תכנן זמן ריכוז</p>
                  <p className="text-xs text-gray-600">הקדש 2-3 שעות רצופות למשימות חשובות</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                  <p className="font-semibold text-xs text-amber-800">סיכום יומי</p>
                  <p className="text-xs text-gray-600">כל ערב בדוק מה הושג ומה נשאר ליום הבא</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Meal reminders */}
        <Card className="border-orange-200 bg-orange-50">
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
                <button onClick={() => removeMealReminder(index)} className="text-gray-300 hover:text-amber-500 p-1"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Break reminders */}
        <Card className="border-green-200 bg-green-50">
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

// =====================================================
// =====================================================
// AUTOMATION SETTINGS — Log, Pause Toggle, Cognitive Load Limit
// =====================================================

function AutomationSettings() {
  const [log, setLog] = useState(() => getAutomationLog());
  // ── Consolidated: use DesignContext as single source of truth ──
  const design = useDesign();
  const paused = design.automationsPaused || false;
  const cogLimit = design.cognitiveLoadLimit || 480;

  const togglePause = () => {
    design.updatePref('automationsPaused', !paused);
  };

  const updateCogLimit = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    design.updatePref('cognitiveLoadLimit', num);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-bold text-gray-800">אוטומציות ובקרה</h2>
      </div>

      {/* Global Pause Toggle */}
      <Card className={`border-2 ${paused ? 'border-orange-300 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paused ? 'bg-orange-100' : 'bg-green-100'}`}>
                <Zap className={`w-5 h-5 ${paused ? 'text-orange-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {paused ? 'אוטומציות מושהות' : 'אוטומציות פעילות'}
                </div>
                <div className="text-xs text-gray-500">
                  {paused ? 'כל הפעולות האוטומטיות מושהות — עבודה ידנית בלבד' : 'ארכיון אוטומטי, נעילת תלויות, והתראות עומס פעילים'}
                </div>
              </div>
            </div>
            <Switch checked={!paused} onCheckedChange={togglePause} />
          </div>
        </CardContent>
      </Card>

      {/* Cognitive Load Threshold */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            סף עומס קוגניטיבי יומי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">
            כשסך הדקות של משימות פעילות היום חורג מהסף — מסגרת הפוקוס היומי תהפוך לאדום/כתום.
          </p>
          <div className="flex items-center gap-3">
            <Input type="number" value={cogLimit} onChange={e => updateCogLimit(e.target.value)}
              className="w-24 text-center font-bold" min={60} max={960} step={30} />
            <span className="text-xs text-gray-500">דקות ({Math.round(cogLimit / 60)} שעות)</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Automations List */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">אוטומציות פעילות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: 'ארכיון אוטומטי', desc: 'משימות שהושלמו עוברות לארכיון אחרי 24 שעות', active: !paused },
            { name: 'זרימה מותנית', desc: 'משימת המשך "נפתחת" כשהתנאי הקודם הושלם', active: !paused },
            { name: 'סנכרון סטטוס', desc: 'ענף אב פועם כשמשימת-בת בביצוע', active: !paused },
            { name: 'התראת עומס', desc: 'מסגרת אדומה כשעומס יומי חורג מהסף', active: true },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className={`w-2 h-2 rounded-full ${a.active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1">
                <div className="text-xs font-bold text-gray-700">{a.name}</div>
                <div className="text-[12px] text-gray-400">{a.desc}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Automation Log */}
      <Card className="border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              לוג אוטומציות
              <Badge className="bg-gray-100 text-gray-600 text-[12px]">{log.length}</Badge>
            </CardTitle>
            {log.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { clearAutomationLog(); setLog([]); }}
                className="text-[12px] text-gray-400 h-6 px-2">
                <Trash2 className="w-3 h-3 me-1" /> נקה
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">
              אין פעולות אוטומטיות עדיין
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {log.slice(0, 50).map(entry => (
                <div key={entry.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-gray-50 text-[12px]">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    entry.action === 'task_unlocked' ? 'bg-green-500' :
                    entry.action === 'task_archived' ? 'bg-blue-500' : 'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-700">
                      {entry.action === 'task_unlocked' ? 'נפתחה' :
                       entry.action === 'task_archived' ? 'הועברה לארכיון' : entry.action}
                    </span>
                    {entry.taskTitle && (
                      <span className="text-gray-500"> — {entry.taskTitle}</span>
                    )}
                    {entry.unlockedBy && (
                      <span className="text-green-600"> (אחרי: {entry.unlockedBy})</span>
                    )}
                  </div>
                  <span className="text-gray-300 shrink-0 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to full AutomationRules page (consolidated view) */}
      <Link to={createPageUrl("AutomationRules")}
        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-sm font-medium text-purple-700">
        <ExternalLink className="w-4 h-4" />
        פתח את מרכז כללי האוטומציה המלא
      </Link>
    </div>
  );
}

// =====================================================
// DATA CLEANUP — Delete old tasks before a cutoff date
// =====================================================

function DataCleanupSection() {
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [deleteResult, setDeleteResult] = useState(null);
  const CUTOFF_DATE = '2026-03-01';

  const scanOldTasks = async () => {
    setIsScanning(true);
    setScanResult(null);
    setDeleteResult(null);
    try {
      const allTasks = await Task.list(null, 5000);
      const oldTasks = allTasks.filter(t => {
        if (!t.due_date) return false;
        return t.due_date < CUTOFF_DATE;
      });
      const noDateTasks = allTasks.filter(t => !t.due_date);
      setScanResult({
        total: allTasks.length,
        oldCount: oldTasks.length,
        noDateCount: noDateTasks.length,
        keepCount: allTasks.length - oldTasks.length,
        oldTasks,
      });
    } catch (e) {
      setScanResult({ error: e.message });
    }
    setIsScanning(false);
  };

  const deleteOldTasks = async () => {
    if (!scanResult?.oldTasks?.length) return;
    if (!window.confirm(`למחוק ${scanResult.oldCount} משימות עם due_date לפני ${CUTOFF_DATE}?\n\nפעולה זו בלתי הפיכה — מוחק מ-Supabase ומ-localStorage.`)) return;
    setIsDeleting(true);
    setDeleteResult(null);
    const log = [];
    let supaDeleted = 0;
    let localDeleted = 0;
    let supaError = null;

    // Collect ALL task IDs from the scan (already filtered client-side)
    const idsToDelete = scanResult.oldTasks.map(t => t.id);
    log.push(`IDs to delete: ${idsToDelete.length} (from scan)`);

    // ── LAYER 1: Supabase — batch DELETE by ID (not JSONB filter) ──
    try {
      const mod = await import('@/api/supabaseClient');
      const supabase = mod.supabase;
      const isConfigured = mod.isSupabaseConfigured;

      if (isConfigured && supabase) {
        // Delete in batches of 50 by primary key — guaranteed to work
        for (let i = 0; i < idsToDelete.length; i += 50) {
          const batchIds = idsToDelete.slice(i, i + 50);
          const { data: deleted, error } = await supabase
            .from('app_data')
            .delete()
            .eq('collection', 'tasks')
            .in('id', batchIds)
            .select('id');

          if (error) {
            log.push(`Supabase batch ${Math.floor(i/50)+1} error: ${error.message}`);
            if (!supaError) supaError = error.message;
          } else {
            const count = deleted?.length || 0;
            supaDeleted += count;
            log.push(`Supabase batch ${Math.floor(i/50)+1}: deleted ${count}/${batchIds.length}`);
          }
        }
        log.push(`Supabase total: ${supaDeleted} rows deleted`);
      } else {
        log.push('Supabase not configured — skipping cloud delete');
      }
    } catch (e) {
      supaError = e.message;
      log.push(`Supabase error: ${e.message}`);
    }

    // ── LAYER 2: Clean localStorage by removing matching IDs ──
    try {
      const idSet = new Set(idsToDelete);
      const raw = localStorage.getItem('calmplan_tasks');
      if (raw) {
        const tasks = JSON.parse(raw);
        const before = tasks.length;
        const cleaned = tasks.filter(t => !idSet.has(t.id));
        localStorage.setItem('calmplan_tasks', JSON.stringify(cleaned));
        localDeleted = before - cleaned.length;
        log.push(`localStorage: removed ${localDeleted} of ${before}, ${cleaned.length} remain`);
      }
    } catch (e) {
      log.push(`localStorage error: ${e.message}`);
    }

    console.log('[DataCleanup] Log:', log.join('\n'));
    setDeleteResult({ supaDeleted, localDeleted, supaError, log });
    setScanResult(null);
    setIsDeleting(false);
  };

  return (
    <Card className="border-2 border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-600" />
          ניקוי נתונים ישנים
          <Badge className="bg-red-100 text-red-700 text-[12px]">לפני מרץ 2026</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-600">
          מוחק את כל המשימות עם תאריך יעד (due_date) לפני 01/03/2026 — מ-LocalStorage ומ-Database.
          <br />דף חלק למרץ.
        </p>

        {/* Step 1: Scan */}
        <Button
          variant="outline"
          size="sm"
          onClick={scanOldTasks}
          disabled={isScanning || isDeleting}
          className="gap-2 text-xs border-red-300 text-red-700 hover:bg-red-100"
        >
          {isScanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
          שלב 1: סרוק משימות ישנות
        </Button>

        {/* Scan results */}
        {scanResult && !scanResult.error && (
          <div className="p-3 bg-white border border-red-200 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">סה"כ משימות:</span>
                <span className="font-bold">{scanResult.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">למחיקה (לפני מרץ):</span>
                <span className="font-bold text-red-700">{scanResult.oldCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ללא תאריך:</span>
                <span className="font-bold text-orange-600">{scanResult.noDateCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">נשארות (מרץ+):</span>
                <span className="font-bold text-green-700">{scanResult.keepCount}</span>
              </div>
            </div>

            {scanResult.oldCount > 0 && (
              <Button
                size="sm"
                onClick={deleteOldTasks}
                disabled={isDeleting}
                className="w-full gap-2 text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {isDeleting
                  ? 'מוחק...'
                  : `שלב 2: מחק ${scanResult.oldCount} משימות ישנות`
                }
              </Button>
            )}
            {scanResult.oldCount === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="w-4 h-4" />
                אין משימות ישנות — הכל נקי!
              </div>
            )}
          </div>
        )}

        {scanResult?.error && (
          <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
            שגיאה: {scanResult.error}
          </div>
        )}

        {/* Delete results */}
        {deleteResult && (
          <div className={`p-3 rounded-lg space-y-2 ${deleteResult.supaError ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className={`w-5 h-5 ${deleteResult.supaError ? 'text-orange-500' : 'text-green-600'}`} />
              <p className="font-bold text-sm text-gray-800">סיכום מחיקה</p>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Server className="w-3 h-3 text-blue-500" />
                <span>Supabase: נמחקו <strong>{deleteResult.supaDeleted}</strong> שורות</span>
                {deleteResult.supaError && (
                  <Badge className="bg-orange-100 text-orange-700 text-[12px]">{deleteResult.supaError}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-purple-500" />
                <span>localStorage: הוסרו <strong>{deleteResult.localDeleted}</strong> משימות</span>
              </div>
            </div>
            {deleteResult.log?.length > 0 && (
              <details className="text-[12px] text-gray-500 mt-1">
                <summary className="cursor-pointer hover:text-gray-700">לוג מפורט</summary>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-[12px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {deleteResult.log.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PurgeAllSection() {
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  const handlePurgeLocalStorage = async () => {
    if (!window.confirm('⚠️ פעולה זו תמחק את כל ה-LocalStorage (נתוני מטמון, הגדרות עיצוב, תפריט אישי, גיבויים מקומיים).\n\nנתוני Supabase לא ייפגעו.\n\nלהמשיך?')) return;
    setIsPurging(true);
    setPurgeResult(null);
    const log = [];
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('calmplan')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => {
        localStorage.removeItem(k);
        log.push(`Removed: ${k}`);
      });
      log.push(`Total purged: ${keysToRemove.length} keys`);
      setPurgeResult({ success: true, count: keysToRemove.length, log });
    } catch (e) {
      setPurgeResult({ success: false, error: e.message, log });
    }
    setIsPurging(false);
  };

  const handlePurgeMockData = async () => {
    if (!window.confirm('⚠️ פעולה זו תמחק את כל הנתונים הדמו/מוק מהמערכת (Supabase + localStorage).\n\nנתונים אמיתיים (לא דמו) לא ייפגעו.\n\nלהמשיך?')) return;
    setIsPurging(true);
    setPurgeResult(null);
    const log = [];
    try {
      // Delete demo tasks from Task entity
      const allTasks = await Task.list(null, 5000).catch(() => []);
      const demoTasks = (allTasks || []).filter(t => t.isDemo || t.source === 'demo' || t.source === 'seed');
      let deleted = 0;
      for (const t of demoTasks) {
        try { await Task.delete(t.id); deleted++; } catch { /* skip */ }
      }
      log.push(`Demo tasks deleted: ${deleted} of ${demoTasks.length}`);

      // Clean localStorage demo markers
      const raw = localStorage.getItem('calmplan_tasks');
      if (raw) {
        const tasks = JSON.parse(raw);
        const cleaned = tasks.filter(t => !t.isDemo && t.source !== 'demo' && t.source !== 'seed');
        localStorage.setItem('calmplan_tasks', JSON.stringify(cleaned));
        log.push(`localStorage cleaned: ${tasks.length - cleaned.length} demo tasks removed`);
      }

      setPurgeResult({ success: true, count: deleted, log });
    } catch (e) {
      setPurgeResult({ success: false, error: e.message, log });
    }
    setIsPurging(false);
  };

  const handleNuclearPurge = async () => {
    if (!window.confirm('☢️ NUCLEAR PURGE — מוחק הכל!\n\nכל ה-LocalStorage + כל הנתונים ב-DB.\nפעולה בלתי הפיכה.\n\nלהמשיך?')) return;
    if (!window.confirm('בטוחה? לא ניתן לשחזר נתונים שנמחקו.')) return;
    setIsPurging(true);
    try {
      const { clearAllData } = await import('@/api/base44Client');
      clearAllData();
      // Clear ALL localStorage (not just calmplan_ prefix)
      localStorage.clear();
      setPurgeResult({ success: true, count: -1, log: ['NUCLEAR: All data cleared. Reloading...'] });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setPurgeResult({ success: false, error: e.message, log: [] });
      setIsPurging(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-purple-600" />
          ניקוי כללי ומחיקת נתוני דמו
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={handlePurgeLocalStorage} disabled={isPurging}
            className="gap-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-100">
            <Database className="w-3 h-3" />
            נקה LocalStorage
          </Button>
          <Button variant="outline" size="sm" onClick={handlePurgeMockData} disabled={isPurging}
            className="gap-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-100">
            <Trash2 className="w-3 h-3" />
            מחק נתוני דמו
          </Button>
          <Button variant="outline" size="sm" onClick={handleNuclearPurge} disabled={isPurging}
            className="gap-2 text-xs border-red-400 text-red-700 hover:bg-red-100 font-bold">
            <AlertTriangle className="w-3 h-3" />
            מחיקה מוחלטת
          </Button>
        </div>

        {purgeResult && (
          <div className={`p-3 rounded-lg text-xs ${purgeResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {purgeResult.success ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                {purgeResult.count === -1 ? 'מחיקה מוחלטת — טוען מחדש...' : `נוקו ${purgeResult.count} פריטים בהצלחה`}
              </div>
            ) : (
              <div className="text-red-700">שגיאה: {purgeResult.error}</div>
            )}
            {purgeResult.log?.length > 0 && (
              <details className="mt-2 text-[12px] text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">לוג</summary>
                <pre className="mt-1 p-2 bg-gray-100 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {purgeResult.log.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemSettings() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Monitor className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-bold text-gray-800">הגדרות מערכת</h2>
      </div>
      <ServiceCatalogSection />
      <div className="grid grid-cols-1 gap-4">
        <PurgeAllSection />
        <DataCleanupSection />
        <CloudSyncSection />
        <PlatformManagementSection />
        <DataBackupSection />
      </div>
    </div>
  );
}

// =====================================================
// CLOUD SYNC STATUS & CONFIGURATION
// =====================================================

function CloudSyncSection() {
  const [connectionTest, setConnectionTest] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionTest(null);
    try {
      if (!isSupabaseConfigured) {
        setConnectionTest({ ok: false, message: 'Supabase לא מוגדר. הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY לקובץ .env' });
        setIsTesting(false);
        return;
      }
      const { supabase } = await import('@/api/supabaseClient');
      const { count, error } = await supabase
        .from('app_data')
        .select('id', { count: 'exact', head: true });

      if (error) {
        setConnectionTest({ ok: false, message: `שגיאת חיבור: ${error.message}` });
      } else {
        setConnectionTest({ ok: true, message: `מחובר בהצלחה! ${count} רשומות בענן.` });
      }
    } catch (e) {
      setConnectionTest({ ok: false, message: `שגיאה: ${e.message}` });
    }
    setIsTesting(false);
  };

  return (
    <Card className={`border-2 ${isSupabaseConfigured ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cloud className={`w-4 h-4 ${isSupabaseConfigured ? 'text-green-600' : 'text-orange-500'}`} />
          סנכרון ענן
          {isSupabaseConfigured ? (
            <Badge className="bg-green-100 text-green-700 text-[12px]">מחובר</Badge>
          ) : (
            <Badge className="bg-orange-100 text-orange-700 text-[12px]">מקומי בלבד</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSupabaseConfigured ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">הנתונים מסונכרנים בענן</p>
                <p className="text-xs text-green-600 mt-1">
                  כל שינוי שתבצעי יופיע מיד בכל מכשיר אחר שמחובר לאותו חשבון Supabase.
                  סנכרון בזמן אמת (Realtime) פעיל.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={testConnection} disabled={isTesting} className="text-xs gap-1">
              {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
              בדוק חיבור
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800">מצב מקומי - הנתונים לא מסונכרנים</p>
                <p className="text-xs text-orange-600 mt-1">
                  הנתונים נשמרים רק במכשיר זה. כדי לסנכרן בין מכשירים, הגדירי חשבון Supabase.
                </p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-gray-700">הוראות הגדרה:</p>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>צרי חשבון חינמי ב-<span className="font-mono text-blue-600">supabase.com</span></li>
                <li>צרי פרויקט חדש וטבלה בשם <span className="font-mono">app_data</span></li>
                <li>העתיקי את ה-URL וה-Anon Key מ-Settings → API</li>
                <li>צרי קובץ <span className="font-mono">.env</span> בתיקיית הפרויקט:</li>
              </ol>
              <div className="bg-gray-900 text-green-400 rounded-lg p-2 font-mono text-[11px]">
                VITE_SUPABASE_URL=https://xxx.supabase.co<br/>
                VITE_SUPABASE_ANON_KEY=eyJ...
              </div>
              <p className="text-[12px] text-gray-400">לאחר ההגדרה, בצעי build מחדש ופתחי את האפליקציה.</p>
            </div>
            <Button variant="outline" size="sm" onClick={testConnection} disabled={isTesting} className="text-xs gap-1">
              {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
              בדוק חיבור
            </Button>
          </div>
        )}
        {connectionTest && (
          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${connectionTest.ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {connectionTest.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {connectionTest.message}
          </div>
        )}
      </CardContent>
    </Card>
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
            {saveStatus === 'saved' && <Badge className="bg-green-100 text-green-700 text-[12px]">נשמר</Badge>}
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
            <Badge className={`${plat.color} text-[12px]`}>{plat.name}</Badge>
            <span className="text-[12px] text-gray-400 flex-1">{plat.fields.length} שדות</span>
            <button onClick={() => setEditingPlatform({ ...plat })} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
            <button onClick={() => deletePlatform(plat.id)} className="p-1 text-gray-400 hover:text-amber-600"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}

        {editingPlatform && (
          <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50 space-y-3 mt-2">
            <h4 className="font-semibold text-sm">{editingPlatform.isNew ? 'פלטפורמה חדשה' : `עריכה: ${editingPlatform.name}`}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><Label className="text-[12px]">שם</Label><Input value={editingPlatform.name} onChange={e => setEditingPlatform(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" /></div>
              <div><Label className="text-[12px]">אייקון</Label>
                <select value={editingPlatform.icon} onChange={e => setEditingPlatform(p => ({ ...p, icon: e.target.value }))} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div><Label className="text-[12px]">צבע</Label>
                <select value={editingPlatform.color} onChange={e => setEditingPlatform(p => ({ ...p, color: e.target.value }))} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  {COLOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="flex items-end"><Badge className={`${editingPlatform.color} px-3 py-1`}>{editingPlatform.name || '...'}</Badge></div>
            </div>
            <div>
              <Label className="text-[12px] font-semibold">שדות</Label>
              <div className="space-y-1 mt-1">
                {editingPlatform.fields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border">
                    <span className="font-mono text-[12px] text-gray-500 w-24 truncate">{field.key}</span>
                    <span className="flex-1">{field.label}</span>
                    <button onClick={() => removeFieldFromEditing(idx)} className="text-amber-400 hover:text-amber-600"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                <Input value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value.replace(/\s/g, '_') }))} placeholder="key" className="text-[12px] h-7" dir="ltr" />
                <Input value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="תווית" className="text-[12px] h-7" />
                <Input value={newField.placeholder} onChange={e => setNewField(p => ({ ...p, placeholder: e.target.value }))} placeholder="placeholder" className="text-[12px] h-7" dir="ltr" />
                <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))} className="border rounded-md px-1 text-[12px]">
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
  const [lastSupaBackup, setLastSupaBackup] = useState(() => localStorage.getItem('calmplan_last_supa_backup'));
  const [isSavingToSupa, setIsSavingToSupa] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-backup: save snapshot to localStorage every 2 hours + daily to Supabase
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

    // Daily Supabase backup - check on load and every hour
    const runDailySupaBackup = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const lastSupa = localStorage.getItem('calmplan_last_supa_backup');
        const today = new Date().toISOString().split('T')[0];
        if (lastSupa === today) return; // Already backed up today

        const { saveDailyBackupToSupabase } = await import('@/api/supabaseDB');
        const result = await saveDailyBackupToSupabase();
        if (result.saved) {
          localStorage.setItem('calmplan_last_supa_backup', today);
          setLastSupaBackup(today);
        } else {
          localStorage.setItem('calmplan_last_supa_backup', today);
          setLastSupaBackup(today);
        }
      } catch (e) {
        console.error('Daily Supabase backup failed:', e);
      }
    };

    // Run immediately on enable
    runAutoBackup();
    runDailySupaBackup();
    // localStorage backup every 2 hours, Supabase check every hour
    const localInterval = setInterval(runAutoBackup, 2 * 60 * 60 * 1000);
    const supaInterval = setInterval(runDailySupaBackup, 60 * 60 * 1000);
    return () => { clearInterval(localInterval); clearInterval(supaInterval); };
  }, [autoBackupEnabled]);

  const handleManualSupaBackup = async () => {
    setIsSavingToSupa(true);
    try {
      const { saveDailyBackupToSupabase } = await import('@/api/supabaseDB');
      const result = await saveDailyBackupToSupabase();
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('calmplan_last_supa_backup', today);
      setLastSupaBackup(today);
      setBackupStatus({ type: 'success', message: result.saved ? `גיבוי יומי נשמר ב-Supabase (${result.date})` : `גיבוי להיום כבר קיים ב-Supabase` });
    } catch (e) {
      setBackupStatus({ type: 'error', message: 'שגיאה בגיבוי ל-Supabase: ' + e.message });
    }
    setIsSavingToSupa(false);
  };

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
          <Badge variant={isSupabaseConfigured ? "default" : "outline"} className={`text-[12px] mr-auto ${isSupabaseConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {isSupabaseConfigured ? <><Cloud className="w-3 h-3 ms-1" /> Supabase</> : <><AlertTriangle className="w-3 h-3 ms-1" /> localStorage</>}
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
              <Button onClick={downloadAutoBackup} variant="outline" size="sm" className="h-6 text-[12px] border-blue-300 text-blue-700">
                <Download className="w-3 h-3 ms-1" /> הורד גיבוי אוטומטי
              </Button>
            </div>
          )}
          <p className="text-[12px] text-blue-600/70">שומר snapshot כל 2 שעות בדפדפן + גיבוי יומי אוטומטי ל-Supabase.</p>
        </div>

        {/* Daily Supabase backup */}
        {isSupabaseConfigured && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">גיבוי יומי ל-Supabase</span>
              </div>
              <Badge className="bg-green-100 text-green-800 text-[12px]">
                {lastSupaBackup ? `${lastSupaBackup}` : 'טרם בוצע'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">
                {lastSupaBackup
                  ? `גיבוי אחרון: ${lastSupaBackup}`
                  : 'טרם בוצע גיבוי ל-Supabase'}
              </span>
              <Button onClick={handleManualSupaBackup} disabled={isSavingToSupa} variant="outline" size="sm" className="h-6 text-[12px] border-green-300 text-green-700">
                <Cloud className="w-3 h-3 ms-1" /> {isSavingToSupa ? 'שומר...' : 'גבה עכשיו'}
              </Button>
            </div>
            <p className="text-[12px] text-green-600/70">נשמר אוטומטית פעם ביום. שומר 7 גיבויים אחרונים.</p>
          </div>
        )}

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
          <div className={`p-2 rounded-lg text-xs ${backupStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            {backupStatus.message}
          </div>
        )}
        {migrationResult && (
          <div className={`p-2 rounded-lg text-xs ${migrationResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            <p className="font-medium">{migrationResult.message}</p>
            {migrationResult.details && (
              <ul className="mt-1 space-y-0.5">
                {migrationResult.details.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className={c.status === 'migrated' ? 'text-green-600' : c.status === 'skipped' ? 'text-gray-500' : 'text-amber-600'}>
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
