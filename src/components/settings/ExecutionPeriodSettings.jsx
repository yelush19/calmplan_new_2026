import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Timer, Calendar, Info } from 'lucide-react';
import {
  DEFAULT_EXECUTION_PERIODS,
  loadExecutionPeriods,
  saveExecutionPeriods,
} from '@/config/automationRules';
import { ALL_SERVICES } from '@/config/processTemplates';
import { toast } from 'sonner';

// Group services by dashboard
const GROUPS = [
  { key: 'tax', label: 'דיווחי מיסים', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'payroll', label: 'שכר', color: 'bg-blue-100 text-blue-700' },
  { key: 'additional', label: 'שירותים נוספים', color: 'bg-violet-100 text-violet-700' },
];

export default function ExecutionPeriodSettings() {
  const [periods, setPeriods] = useState({});
  const [configId, setConfigId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    const result = await loadExecutionPeriods();
    setPeriods(result.periods);
    setConfigId(result.configId);
    setIsLoading(false);
  };

  const handleChange = (category, field, value) => {
    setPeriods(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value === '' ? null : Number(value),
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newId = await saveExecutionPeriods(configId, periods);
      if (newId) setConfigId(newId);
      toast.success('תבניות תקופות ביצוע נשמרו');
    } catch {
      toast.error('שגיאה בשמירה');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setPeriods({ ...DEFAULT_EXECUTION_PERIODS });
    toast.info('אופס לברירת מחדל');
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">טוען תבניות...</div>;
  }

  // Get all categories from services, grouped
  const getGroupCategories = (dashboardKey) => {
    return Object.values(ALL_SERVICES)
      .filter(s => s.dashboard === dashboardKey || (dashboardKey === 'additional' && s.dashboard === 'additional'))
      .map(s => ({
        serviceKey: s.key,
        category: s.createCategory,
        label: s.label,
      }));
  };

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="w-5 h-5 text-violet-600" />
          תבניות תקופת ביצוע לפי סוג שירות
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          הגדר עבור כל סוג שירות/משימה את יום ההתחלה בחודש ואת כמות ימי המרווח לפני הדדליין.
          כאשר נוצרת משימה חדשה, תקופת הביצוע תמולא אוטומטית.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info box */}
        <div className="bg-violet-50 rounded-lg p-3 flex gap-2 text-xs text-violet-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>יום התחלה</strong> = באיזה יום בחודש מתחילים לעבוד (למשל 1, 5, 15).
            <br />
            <strong>ימי מרווח</strong> = כמה ימים לפני הדדליין להתחיל (אם אין יום התחלה קבוע).
            <br />
            אם שני השדות מלאים, יום ההתחלה הקבוע מקבל עדיפות.
          </div>
        </div>

        {GROUPS.map(group => {
          const categories = getGroupCategories(group.key);
          if (categories.length === 0) return null;

          return (
            <div key={group.key}>
              <Badge className={`text-xs mb-3 ${group.color}`}>{group.label}</Badge>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 text-[10px] text-gray-500 font-medium px-1">
                  <span>שירות</span>
                  <span className="text-center">יום התחלה</span>
                  <span className="text-center">ימי מרווח</span>
                </div>
                {categories.map(({ category, label }) => {
                  const p = periods[category] || {};
                  return (
                    <div
                      key={category}
                      className="grid grid-cols-[1fr_90px_90px] gap-2 items-center bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800">{label}</span>
                        <span className="text-[10px] text-gray-400 mr-2">({category})</span>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        max="28"
                        value={p.start_day ?? ''}
                        onChange={(e) => handleChange(category, 'start_day', e.target.value)}
                        placeholder="—"
                        className="text-center text-sm h-8"
                      />
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={p.buffer_days ?? ''}
                        onChange={(e) => handleChange(category, 'buffer_days', e.target.value)}
                        placeholder="—"
                        className="text-center text-sm h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'שמור תבניות'}
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            אפס לברירת מחדל
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
