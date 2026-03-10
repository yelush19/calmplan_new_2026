import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Trash2, Clock, CheckCircle, ArrowRight,
  AlertTriangle, ToggleLeft, ToggleRight, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getFollowUpRules, registerFollowUpRule } from '@/engines/TaskInjectionEngine';
import { ALL_SERVICES } from '@/config/processTemplates';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

const DEFAULT_DELAY = 7;

function RuleCard({ serviceKey, rule, onToggle, onDelete }) {
  const [enabled, setEnabled] = useState(true);

  const handleToggle = () => {
    setEnabled((v) => !v);
    onToggle?.(serviceKey, !enabled);
  };

  const serviceLabel = ALL_SERVICES[serviceKey]?.label || resolveCategoryLabel(serviceKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className={`border transition-colors ${enabled ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Icon + Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`p-2 rounded-lg ${enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {serviceLabel}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  מעקב אחרי {rule.delayDays} ימים
                  <ArrowRight className="w-3 h-3 mx-1" />
                  <span className="text-gray-700">{rule.newCategory || serviceKey}</span>
                </div>
                {rule.newDescription && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{rule.newDescription}</p>
                )}
              </div>
            </div>

            {/* Right: Toggle + Delete */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className={enabled ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-400'}>
                {enabled ? 'פעיל' : 'מושבת'}
              </Badge>
              <button onClick={handleToggle} className="p-1 hover:bg-gray-100 rounded">
                {enabled
                  ? <ToggleRight className="w-6 h-6 text-green-500" />
                  : <ToggleLeft className="w-6 h-6 text-gray-400" />
                }
              </button>
              {onDelete && (
                <button onClick={() => onDelete(serviceKey)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AutomationPage() {
  const [rules, setRules] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newService, setNewService] = useState('');
  const [newDelay, setNewDelay] = useState(DEFAULT_DELAY);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    setRules(getFollowUpRules());
  }, []);

  const handleAdd = useCallback(() => {
    if (!newService.trim()) return;
    const key = newService.trim().toLowerCase().replace(/\s+/g, '_');
    const rule = {
      trigger: 'production_completed',
      delayDays: Number(newDelay) || DEFAULT_DELAY,
      newTitle: (src) => `${src.client_name} — ${newCategory || key} (מעקב)`,
      newCategory: newCategory || key,
      newBranch: 'P3',
      newPriority: 'medium',
      newDescription: `כלל מעקב מותאם: ${newCategory || key}`,
      newTags: ['auto-followup', 'custom-rule'],
    };
    registerFollowUpRule(key, rule);
    setRules((prev) => ({ ...prev, [key]: rule }));
    setShowAdd(false);
    setNewService('');
    setNewDelay(DEFAULT_DELAY);
    setNewCategory('');
  }, [newService, newDelay, newCategory]);

  const handleDelete = useCallback((key) => {
    setRules((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const ruleEntries = Object.entries(rules);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            אוטומציות P3
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            כללי מעקב אוטומטיים — כשמשימה מסתיימת, נוצרת משימת מעקב באופן אוטומטי.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd((v) => !v)}
          variant="outline"
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          כלל חדש
        </Button>
      </div>

      {/* 3-Day Rule Info */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-sm text-amber-800">כלל 3 ימים (פעיל תמיד)</div>
            <p className="text-xs text-amber-700 mt-1">
              משימות שמועד הסיום שלהן תוך 3 ימים מופיעות אוטומטית בפתקים הדביקים בעמוד הבית.
              כלל זה פעיל תמיד ואינו ניתן לביטול.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add New Rule */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">כלל מעקב חדש</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">שם שירות / מפתח</label>
                    <Input
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      placeholder="bank_reconciliation"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ימי המתנה</label>
                    <Input
                      type="number"
                      value={newDelay}
                      onChange={(e) => setNewDelay(e.target.value)}
                      min={1}
                      max={365}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">קטגוריה חדשה</label>
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="התאמות"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>ביטול</Button>
                  <Button size="sm" onClick={handleAdd} className="gap-1">
                    <CheckCircle className="w-4 h-4" />
                    הוסף כלל
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules List */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          {ruleEntries.length} כללים מוגדרים
        </div>
        <AnimatePresence>
          {ruleEntries.map(([key, rule]) => (
            <RuleCard
              key={key}
              serviceKey={key}
              rule={rule}
              onDelete={handleDelete}
            />
          ))}
        </AnimatePresence>
        {ruleEntries.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            אין כללים מוגדרים. לחץ "כלל חדש" כדי להתחיל.
          </div>
        )}
      </div>
    </div>
  );
}
