import React, { useState, useEffect } from 'react';
import { SystemConfig, Task } from '@/api/entities';
import { COMPLEXITY_TIERS } from '@/lib/theme-constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, CheckCircle, Loader2, Scale, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const CONFIG_KEY = 'service_weights';

export default function ServiceWeightsSettings() {
  const [categories, setCategories] = useState([]);
  const [weights, setWeights] = useState({});
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load existing service weight overrides from SystemConfig
      const configs = await SystemConfig.list(null, 100);
      const swConfig = configs.find(c => c.config_key === CONFIG_KEY);
      if (swConfig) {
        setConfigId(swConfig.id);
        setWeights(swConfig.data || {});
      }

      // Discover all unique task categories from real tasks
      const tasks = await Task.list();
      const catSet = new Set();
      (tasks || []).forEach(t => {
        if (t.category) catSet.add(t.category);
      });
      const sorted = Array.from(catSet).sort((a, b) => a.localeCompare(b, 'he'));
      setCategories(sorted);
    } catch (error) {
      console.error('Error loading service weights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWeight = (category, field, value) => {
    setWeights(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [field]: value,
      },
    }));
    setSaveStatus(null);
  };

  const clearWeight = (category) => {
    setWeights(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      // Clean empty entries
      const cleanWeights = {};
      Object.entries(weights).forEach(([cat, w]) => {
        if (w.duration || w.cognitiveLoad != null) {
          cleanWeights[cat] = {};
          if (w.duration) cleanWeights[cat].duration = Number(w.duration);
          if (w.cognitiveLoad != null && w.cognitiveLoad !== '') cleanWeights[cat].cognitiveLoad = Number(w.cognitiveLoad);
        }
      });

      if (configId) {
        await SystemConfig.update(configId, { data: cleanWeights });
      } else {
        const newConfig = await SystemConfig.create({ config_key: CONFIG_KEY, data: cleanWeights });
        setConfigId(newConfig.id);
      }
      setWeights(cleanWeights);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Error saving service weights:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const overrideCount = Object.keys(weights).filter(k => weights[k]?.duration || weights[k]?.cognitiveLoad != null).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">טוען קטגוריות שירות...</span>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            משקלות שירותים — הגדרת משך וקוגניציה לפי קטגוריה
          </h1>
          <p className="text-muted-foreground mt-1">
            כאן ניתן להגדיר עדיפות ומשך ברירת מחדל לכל סוג שירות.
            הגדרות אלו גוברות על הטייר של הלקוח בעת פתיחת משימה.
            <strong> ללא הגדרה — המערכת תשתמש בנתוני הלקוח מעמוד האפיון בלבד.</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {overrideCount > 0 && (
            <Badge variant="outline" className="text-primary border-primary/30">
              {overrideCount} הגדרות פעילות
            </Badge>
          )}

          {saveStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-green-600 text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              נשמר בהצלחה
            </motion.div>
          )}

          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm">שגיאה בשמירה</span>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור הגדרות
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>איך זה עובד:</strong> כשמשימה נפתחת, המערכת בודקת קודם את <strong>נתוני הלקוח מעמוד האפיון</strong> (employee_count, complexity_level).
          רק אם הגדרת כאן דריסה לקטגוריה ספציפית — היא תגבור על ערכי הטייר.
          שורות ריקות = אין דריסה, הכל מהלקוח.
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>לא נמצאו קטגוריות משימות במערכת.</p>
          <p className="text-sm mt-1">צור משימות עם קטגוריות כדי שיופיעו כאן.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F5] border-b">
                <th className="text-right py-2.5 px-4 font-medium">קטגוריה</th>
                <th className="text-right py-2.5 px-4 font-medium w-[140px]">משך (דקות)</th>
                <th className="text-right py-2.5 px-4 font-medium w-[180px]">עומס קוגניטיבי</th>
                <th className="text-center py-2.5 px-4 font-medium w-[80px]">איפוס</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const w = weights[cat] || {};
                const hasOverride = w.duration || w.cognitiveLoad != null;
                return (
                  <tr key={cat} className={`border-b hover:bg-[#FAFAFA] ${hasOverride ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-2 px-4 font-medium text-[#263238]">{cat}</td>
                    <td className="py-2 px-4">
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={w.duration || ''}
                        onChange={(e) => updateWeight(cat, 'duration', e.target.value)}
                        placeholder="מהלקוח"
                        className="h-8 text-xs w-full"
                        dir="ltr"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <Select
                        value={w.cognitiveLoad != null ? String(w.cognitiveLoad) : ''}
                        onValueChange={(v) => updateWeight(cat, 'cognitiveLoad', v === '' ? null : Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="מהלקוח" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-xs">מהלקוח (ללא דריסה)</SelectItem>
                          {Object.entries(COMPLEXITY_TIERS).map(([tier, info]) => (
                            <SelectItem key={tier} value={tier} className="text-xs">
                              {info.icon} {info.label} ({info.maxMinutes} דק׳)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-4 text-center">
                      {hasOverride && (
                        <button
                          onClick={() => clearWeight(cat)}
                          className="text-[#78909C] hover:text-red-500 transition-colors"
                          title="הסר דריסה — חזור לנתוני לקוח"
                        >
                          <RotateCcw className="w-4 h-4 mx-auto" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
