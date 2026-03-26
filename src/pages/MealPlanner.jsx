import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Soup,
  Carrot,
  Plus,
  Trash2,
  ChefHat,
  Salad,
  Sandwich,
  Coffee,
  Save,
  Loader2
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MealPlan } from '@/api/entities';
import { toast } from 'sonner';

const MEAL_IDEAS = [
  { title: "סלט עשיר", category: "ארוחה קלה", icon: "Salad", time: 20 },
  { title: "כריך מפנק", category: "ארוחה קלה", icon: "Sandwich", time: 10 },
  { title: "פסטה ברוטב עגבניות", category: "ארוחת ערב", icon: "Soup", time: 25 },
  { title: "שניצל ופירה", category: "ארוחת ערב", icon: "ChefHat", time: 40 },
  { title: "קפה ומאפה", category: "פינוק", icon: "Coffee", time: 5 },
  { title: "ירקות בתנור", category: "תוספת", icon: "Carrot", time: 45 },
];

const ICON_MAP = { Salad, Sandwich, Soup, ChefHat, Coffee, Carrot };
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getWeekKey() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

export default function MealPlannerPage() {
  const [groceryList, setGroceryList] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [weeklyPlan, setWeeklyPlan] = useState(
    Array(7).fill(null).map(() => ({ breakfast: '', lunch: '', dinner: '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const weekKey = getWeekKey();
      const plans = await MealPlan.filter({ week_key: weekKey });
      if (plans.length > 0) {
        const plan = plans[0];
        setPlanId(plan.id);
        if (plan.grocery_list) setGroceryList(plan.grocery_list);
        if (plan.weekly_plan) setWeeklyPlan(plan.weekly_plan);
      }
    } catch (err) {
      console.error('Failed to load meal plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveData = useCallback(async (newGrocery, newPlan) => {
    setSaving(true);
    try {
      const weekKey = getWeekKey();
      const payload = {
        week_key: weekKey,
        grocery_list: newGrocery || groceryList,
        weekly_plan: newPlan || weeklyPlan,
      };
      if (planId) {
        await MealPlan.update(planId, payload);
      } else {
        const created = await MealPlan.create(payload);
        setPlanId(created.id);
      }
    } catch (err) {
      console.error('Failed to save meal plan:', err);
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }, [planId, groceryList, weeklyPlan]);

  const handleAddItem = () => {
    if (newItem.trim() === '') return;
    const updated = [...groceryList, { id: Date.now(), name: newItem.trim(), checked: false }];
    setGroceryList(updated);
    setNewItem('');
    saveData(updated, null);
  };

  const handleToggleItem = (id) => {
    const updated = groceryList.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setGroceryList(updated);
    saveData(updated, null);
  };

  const handleRemoveItem = (id) => {
    const updated = groceryList.filter(item => item.id !== id);
    setGroceryList(updated);
    saveData(updated, null);
  };

  const handlePlanChange = (dayIndex, meal, value) => {
    const newPlan = [...weeklyPlan];
    newPlan[dayIndex] = { ...newPlan[dayIndex], [meal]: value };
    setWeeklyPlan(newPlan);
    saveData(null, newPlan);
  };

  if (loading) {
    return (
      <div className="space-y-8 p-6" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-[#1E3A5F]">תכנון ארוחות</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white flex items-center justify-center gap-2">
          <ChefHat className="w-6 h-6" />
          תכנון ארוחות
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">בניית תפריט שבועי ורשימת קניות חכמה</p>
        {saving && (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            שומר...
          </Badge>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* רשימת קניות */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#1E3A5F] dark:text-amber-400 text-base">
                <Carrot className="w-5 h-5" />
                רשימת קניות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="הוסף פריט..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  className="dark:bg-gray-800 dark:border-gray-600"
                />
                <Button onClick={handleAddItem} size="icon" className="bg-emerald-500 hover:bg-emerald-600 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {groceryList.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <Carrot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">רשימת הקניות ריקה</p>
                  <p className="text-xs mt-1">הוסיפו פריטים למעלה</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pe-2">
                  <AnimatePresence>
                    {groceryList.map(item => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`item-${item.id}`}
                            checked={item.checked}
                            onCheckedChange={() => handleToggleItem(item.id)}
                          />
                          <label
                            htmlFor={`item-${item.id}`}
                            className={`cursor-pointer text-sm ${item.checked ? 'line-through text-gray-400' : 'dark:text-gray-200'}`}
                          >
                            {item.name}
                          </label>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="w-7 h-7 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              {groceryList.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => {
                      const unchecked = groceryList.filter(i => !i.checked).map(i => `☐ ${i.name}`);
                      const checked = groceryList.filter(i => i.checked).map(i => `✅ ${i.name}`);
                      const text = `🛒 *רשימת קניות*\n\n${unchecked.join('\n')}${checked.length ? '\n\n_נקנה:_\n' + checked.join('\n') : ''}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                  >
                    📱 שלח בWhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50"
                    onClick={() => {
                      const text = groceryList.filter(i => !i.checked).map(i => `- ${i.name}`).join('\n');
                      navigator.clipboard.writeText(text);
                      alert('הרשימה הועתקה!');
                    }}
                  >
                    📋 העתק
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* תפריט שבועי */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#1E3A5F] dark:text-emerald-400 text-base">
                <Soup className="w-5 h-5" />
                התפריט השבועי שלי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DAYS.map((day, dayIndex) => (
                  <Accordion key={day} type="single" collapsible className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                    <AccordionItem value={day} className="border-none">
                      <AccordionTrigger className="p-3 font-bold text-sm hover:no-underline dark:text-gray-200">
                        {day}
                      </AccordionTrigger>
                      <AccordionContent className="p-3 pt-0 space-y-3">
                        <MealInput label="בוקר" value={weeklyPlan[dayIndex]?.breakfast || ''} onChange={(e) => handlePlanChange(dayIndex, 'breakfast', e.target.value)} />
                        <MealInput label="צהריים" value={weeklyPlan[dayIndex]?.lunch || ''} onChange={(e) => handlePlanChange(dayIndex, 'lunch', e.target.value)} />
                        <MealInput label="ערב" value={weeklyPlan[dayIndex]?.dinner || ''} onChange={(e) => handlePlanChange(dayIndex, 'dinner', e.target.value)} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* רעיונות לארוחות */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#1E3A5F] dark:text-blue-400 text-base">
              <ChefHat className="w-5 h-5" />
              רעיונות לארוחות מהירות
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {MEAL_IDEAS.map(idea => {
              const IconComp = ICON_MAP[idea.icon] || ChefHat;
              return (
                <motion.div key={idea.title} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer border dark:border-gray-700">
                    <CardContent className="p-3 text-center">
                      <IconComp className="w-7 h-7 mx-auto mb-2 text-[#1E3A5F] dark:text-blue-400"/>
                      <p className="font-semibold text-xs dark:text-gray-200">{idea.title}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px]">{idea.category}</Badge>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{idea.time} דקות</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

const MealInput = ({ label, ...props }) => (
  <div className="grid grid-cols-4 items-center gap-3">
    <label className="text-end font-medium text-sm dark:text-gray-300">{label}</label>
    <Input {...props} className="col-span-3 dark:bg-gray-700 dark:border-gray-600" placeholder={`מה אוכלים ל${label}?`} />
  </div>
);
