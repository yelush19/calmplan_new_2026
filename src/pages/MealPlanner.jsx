import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  Coffee
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const mealIdeas = [
    { title: "סלט עשיר", category: "ארוחה קלה", icon: Salad, time: 20 },
    { title: "כריך מפנק", category: "ארוחה קלה", icon: Sandwich, time: 10 },
    { title: "פסטה ברוטב עגבניות", category: "ארוחת ערב", icon: Soup, time: 25 },
    { title: "שניצל ופירה", category: "ארוחת ערב", icon: ChefHat, time: 40 },
    { title: "קפה ומאפה", category: "פינוק", icon: Coffee, time: 5 },
    { title: "ירקות בתנור", category: "תוספת", icon: Carrot, time: 45 },
];

export default function MealPlannerPage() {
  const [groceryList, setGroceryList] = useState([
    { id: 1, name: 'עגבניות', checked: false },
    { id: 2, name: 'מלפפונים', checked: true },
    { id: 3, name: 'חזה עוף', checked: false },
  ]);
  const [newItem, setNewItem] = useState('');
  const [weeklyPlan, setWeeklyPlan] = useState(
    Array(7).fill(null).map(() => ({ breakfast: '', lunch: '', dinner: '' }))
  );
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const handleAddItem = () => {
    if (newItem.trim() !== '') {
      setGroceryList([
        ...groceryList,
        { id: Date.now(), name: newItem.trim(), checked: false },
      ]);
      setNewItem('');
    }
  };

  const handleToggleItem = (id) => {
    setGroceryList(
      groceryList.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };
  
  const handleRemoveItem = (id) => {
    setGroceryList(groceryList.filter(item => item.id !== id));
  };

  const handlePlanChange = (dayIndex, meal, value) => {
    const newPlan = [...weeklyPlan];
    newPlan[dayIndex][meal] = value;
    setWeeklyPlan(newPlan);
  };
  
  return (
    <div className="space-y-8">
       <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-4xl font-bold text-green-800">תכנון ארוחות</h1>
        <p className="text-xl text-gray-600">בניית תפריט שבועי ורשימת קניות חכמה בקלות ובכיף.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* רשימת קניות */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-amber-800">
                <Carrot className="w-6 h-6" />
                רשימת קניות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="הוסף פריט..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <Button onClick={handleAddItem} className="bg-amber-500 hover:bg-amber-600">
                    <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {groceryList.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm">
                    <div className="flex items-center gap-3">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={item.checked}
                          onCheckedChange={() => handleToggleItem(item.id)}
                        />
                        <label 
                          htmlFor={`item-${item.id}`}
                          className={`flex-grow cursor-pointer ${item.checked ? 'line-through text-gray-400' : ''}`}
                        >
                          {item.name}
                        </label>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="w-7 h-7 text-gray-400 hover:text-amber-500 hover:bg-amber-50">
                        <Trash2 className="w-4 h-4"/>
                    </Button>
                  </div>
                ))}
              </div>
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
          <Card className="bg-emerald-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-emerald-800">
                <Soup className="w-6 h-6" />
                התפריט השבועי שלי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {days.map((day, dayIndex) => (
                    <Accordion key={day} type="single" collapsible className="bg-white rounded-lg shadow-sm">
                        <AccordionItem value={day} className="border-none">
                            <AccordionTrigger className="p-4 font-bold text-lg hover:no-underline">
                                {day}
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0 space-y-3">
                               <MealInput label="בוקר" value={weeklyPlan[dayIndex].breakfast} onChange={(e) => handlePlanChange(dayIndex, 'breakfast', e.target.value)} />
                               <MealInput label="צהריים" value={weeklyPlan[dayIndex].lunch} onChange={(e) => handlePlanChange(dayIndex, 'lunch', e.target.value)} />
                               <MealInput label="ערב" value={weeklyPlan[dayIndex].dinner} onChange={(e) => handlePlanChange(dayIndex, 'dinner', e.target.value)} />
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
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-blue-800">
                <ChefHat className="w-6 h-6" />
                רעיונות לארוחות מהירות
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mealIdeas.map(idea => (
                    <Card key={idea.title} className="bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 text-center">
                            <idea.icon className="w-8 h-8 mx-auto mb-2 text-blue-600"/>
                            <p className="font-semibold">{idea.title}</p>
                            <Badge variant="secondary" className="mt-2">{idea.category}</Badge>
                            <p className="text-xs text-gray-500 mt-1">{idea.time} דקות הכנה</p>
                        </CardContent>
                    </Card>
                ))}
            </CardContent>
          </Card>
        </motion.div>
    </div>
  );
}

const MealInput = ({ label, ...props }) => (
    <div className="grid grid-cols-4 items-center gap-4">
        <label className="text-right font-medium">{label}</label>
        <Input {...props} className="col-span-3" placeholder={`מה אוכלים ל${label}?`} />
    </div>
);