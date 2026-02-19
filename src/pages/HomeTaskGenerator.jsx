import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Home, Sparkles, Plus, Trash2, Edit3, Save, X, 
  Clock, Star, CheckCircle, AlertCircle, Settings,
  Soup, ShoppingCart, Flower2, Heart, Wrench
} from 'lucide-react';
import { Task } from '@/api/entities';
import { generateHomeTasks } from '@/api/functions';

// קטגוריות משימות בית עם אייקונים וצבעים
const homeCategories = {
  cleaning: {
    title: "ניקיון וסדר",
    icon: Sparkles,
    color: "bg-blue-100 text-blue-800",
    emoji: "✨"
  },
  food: {
    title: "אוכל וקניות", 
    icon: Soup,
    color: "bg-green-100 text-green-800",
    emoji: "🍽️"
  },
  garden: {
    title: "גינה וצמחים",
    icon: Flower2,
    color: "bg-emerald-100 text-emerald-800", 
    emoji: "🌱"
  },
  family: {
    title: "משפחה וזמן אישי",
    icon: Heart,
    color: "bg-pink-100 text-pink-800",
    emoji: "❤️"
  },
  maintenance: {
    title: "תחזוקה וסידורים",
    icon: Wrench,
    color: "bg-gray-100 text-gray-800",
    emoji: "🔧"
  }
};

// רשימת משימות טיפוسיות לכל קטגוריה
const defaultTasks = {
  cleaning: [
    { title: "ניקיון יסודי - מטבח", category: "home_cleaning_kitchen", duration: 60, priority: "medium", description: "כיורים, כיריים, מיקרוגל, רצפה" },
    { title: "ניקיון יסודי - סלון", category: "home_cleaning_livingroom", duration: 45, priority: "medium", description: "אבק, שאיבה, סידור כללי" },
    { title: "ניקיון שירותים ומקלחות", category: "home_cleaning_bathrooms", duration: 45, priority: "high", description: "אסלות, כיורים, מקלחות, רצפה" },
    { title: "ניקיון חדרי שינה", category: "home_cleaning_bedrooms", duration: 30, priority: "low", description: "החלפת מצעים, אבק, סידור" },
    { title: "כביסה וקיפול", category: "home_laundry", duration: 90, priority: "medium", description: "הפעלת מכונות, ייבוש, קיפול, סידור" }
  ],
  food: [
    { title: "תכנון תפריט שבועי", category: "home_food_planning", duration: 30, priority: "low", description: "תכנון ארוחות לשבוע, רשימת קניות" },
    { title: "קניות שבועיות", category: "home_shopping", duration: 90, priority: "medium", description: "סופר, ירקות, מוצרי ניקיון" },
    { title: "בדיקת מלאי במקרר", category: "home_food_planning", duration: 15, priority: "low", description: "לזרוק מה שפג תוקף, לראות מה חסר" },
    { title: "הכנת ארוחות לשבוע", category: "home_food_planning", duration: 120, priority: "medium", description: "בישול מנות גדולות, הקפאה" }
  ],
  garden: [
    { title: "השקיית גינה ועציצים", category: "home_garden_watering", duration: 20, priority: "low", description: "בדיקה והשקיה לפי הצורך" },
    { title: "תחזוקת גינה", category: "home_garden_maintenance", duration: 60, priority: "medium", description: "גיזום, עישוב, ניקיון" },
    { title: "הזנת צמחים", category: "home_garden_fertilizing", duration: 30, priority: "low", description: "דישון והזנה לפי עונה" }
  ],
  family: [
    { title: "זמן משפחתי איכותי", category: "home_family_time", duration: 120, priority: "high", description: "משחקים, שיחה, פעילות משותפת" },
    { title: "זמן אישי ומנוחה", category: "home_personal_time", duration: 60, priority: "high", description: "קריאה, מדיטציה, תחביבים" },
    { title: "פעילות גופנית", category: "home_exercise", duration: 45, priority: "medium", description: "הליכה, יוגה, כושר" },
    { title: "שנת צהריים בסופש", category: "home_weekend_nap", duration: 60, priority: "low", description: "מנוחה והתאוששות" }
  ],
  maintenance: [
    { title: "סידורים מחוץ לבית", category: "home_errands", duration: 90, priority: "medium", description: "בנק, דואר, קופת חולים" },
    { title: "תחזוקת הבית", category: "home_maintenance", duration: 60, priority: "medium", description: "תיקונים קטנים, החלפת נורות, בדיקות" }
  ]
};

export default function HomeTaskGeneratorPage() {
  const [selectedTasks, setSelectedTasks] = useState({});
  const [customTasks, setCustomTasks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newCustomTask, setNewCustomTask] = useState({
    title: '',
    category: 'home_cleaning_general',
    duration: 30,
    priority: 'medium',
    description: ''
  });

  // טעינת משימות קיימות
  useEffect(() => {
    loadExistingTasks();
  }, []);

  const loadExistingTasks = async () => {
    try {
      const existingTasks = await Task.filter({ context: 'home', is_recurring: true });
      // ממפה משימות קיימות לבחירות
      const selected = {};
      existingTasks.forEach(task => {
        const categoryKey = getCategoryKeyFromTask(task);
        if (!selected[categoryKey]) selected[categoryKey] = {};
        selected[categoryKey][task.title] = true;
      });
      setSelectedTasks(selected);
    } catch (error) {
      console.error("שגיאה בטעינת משימות קיימות:", error);
    }
  };

  const getCategoryKeyFromTask = (task) => {
    if (task.category.includes('cleaning') || task.category.includes('laundry')) return 'cleaning';
    if (task.category.includes('food') || task.category.includes('shopping')) return 'food';
    if (task.category.includes('garden')) return 'garden';
    if (task.category.includes('family') || task.category.includes('personal') || task.category.includes('exercise') || task.category.includes('health')) return 'family';
    return 'maintenance';
  };

  const handleTaskSelection = (categoryKey, taskTitle, isSelected) => {
    setSelectedTasks(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        [taskTitle]: isSelected
      }
    }));
  };

  const handleAddCustomTask = () => {
    if (!newCustomTask.title.trim()) return;
    
    setCustomTasks(prev => [...prev, { ...newCustomTask, id: Date.now() }]);
    setNewCustomTask({
      title: '',
      category: 'home_cleaning_general',
      duration: 30,
      priority: 'medium',
      description: ''
    });
  };

  const handleRemoveCustomTask = (taskId) => {
    setCustomTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleGenerateTasks = async () => {
    setIsGenerating(true);
    try {
      // איסוף משימות נבחרות
      const tasksToCreate = [];
      
      // משימות מהתבנית
      Object.entries(selectedTasks).forEach(([categoryKey, categoryTasks]) => {
        Object.entries(categoryTasks).forEach(([taskTitle, isSelected]) => {
          if (isSelected) {
            const taskTemplate = defaultTasks[categoryKey]?.find(t => t.title === taskTitle);
            if (taskTemplate) {
              tasksToCreate.push({
                ...taskTemplate,
                context: 'home',
                status: 'not_started',
                is_recurring: true,
                recurrence_pattern: 'שבועי',
                estimated_duration: taskTemplate.duration
              });
            }
          }
        });
      });

      // משימות מותאמות אישית
      customTasks.forEach(task => {
        tasksToCreate.push({
          title: task.title,
          category: task.category,
          duration: task.duration,
          priority: task.priority,
          description: task.description,
          context: 'home',
          status: 'not_started',
          is_recurring: true,
          recurrence_pattern: 'שבועי',
          estimated_duration: task.duration
        });
      });

      // יצירת המשימות
      let createdCount = 0;
      for (const taskData of tasksToCreate) {
        try {
          await Task.create(taskData);
          createdCount++;
        } catch (error) {
          console.error(`שגיאה ביצירת משימה ${taskData.title}:`, error);
        }
      }

      alert(`נוצרו בהצלחה ${createdCount} משימות בית!`);
      
    } catch (error) {
      console.error("שגיאה בייצור משימות:", error);
      alert("שגיאה בייצור משימות. נסה שוב.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getTotalSelectedTasks = () => {
    let total = 0;
    Object.values(selectedTasks).forEach(categoryTasks => {
      Object.values(categoryTasks).forEach(isSelected => {
        if (isSelected) total++;
      });
    });
    return total + customTasks.length;
  };

  const getTotalEstimatedTime = () => {
    let totalMinutes = 0;
    
    // זמן מהמשימות הנבחרות
    Object.entries(selectedTasks).forEach(([categoryKey, categoryTasks]) => {
      Object.entries(categoryTasks).forEach(([taskTitle, isSelected]) => {
        if (isSelected) {
          const taskTemplate = defaultTasks[categoryKey]?.find(t => t.title === taskTitle);
          if (taskTemplate) {
            totalMinutes += taskTemplate.duration;
          }
        }
      });
    });

    // זמן מהמשימות המותאמות
    customTasks.forEach(task => {
      totalMinutes += task.duration || 0;
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes };
  };

  const timeEstimate = getTotalEstimatedTime();

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* כותרת */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <Home className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">יוצר משימות בית</h1>
        </div>
        <p className="text-xl text-gray-600">
          בחר משימות טיפוסיות או הוסף משימות מותאמות אישית למשק הבית שלך
        </p>
      </motion.div>

      {/* סיכום */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">{getTotalSelectedTasks()}</div>
              <div className="text-sm text-gray-600">משימות נבחרות</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">
                {timeEstimate.hours}:{timeEstimate.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-600">זמן מוערך שבועי</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">{customTasks.length}</div>
              <div className="text-sm text-gray-600">משימות מותאמות</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* קטגוריות משימות */}
      <div className="grid gap-6">
        {Object.entries(homeCategories).map(([categoryKey, categoryInfo]) => (
          <TaskCategoryCard
            key={categoryKey}
            categoryKey={categoryKey}
            categoryInfo={categoryInfo}
            tasks={defaultTasks[categoryKey] || []}
            selectedTasks={selectedTasks[categoryKey] || {}}
            onTaskSelection={handleTaskSelection}
          />
        ))}
      </div>

      {/* משימות מותאמות אישית */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            משימות מותאמות אישית
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* טופס הוספת משימה מותאמת */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <Input
              placeholder="שם המשימה"
              value={newCustomTask.title}
              onChange={(e) => setNewCustomTask(prev => ({ ...prev, title: e.target.value }))}
            />
            <select
              value={newCustomTask.category}
              onChange={(e) => setNewCustomTask(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border rounded-md"
            >
              <option value="home_cleaning_general">ניקיון כללי</option>
              <option value="home_food_planning">תכנון אוכל</option>
              <option value="home_shopping">קניות</option>
              <option value="home_garden_watering">גינון</option>
              <option value="home_family_time">זמן משפחתי</option>
              <option value="home_maintenance">תחזוקה</option>
            </select>
            <Input
              type="number"
              placeholder="דקות"
              value={newCustomTask.duration}
              onChange={(e) => setNewCustomTask(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            />
            <Button onClick={handleAddCustomTask} disabled={!newCustomTask.title.trim()}>
              <Plus className="w-4 h-4 ml-2" />
              הוסף
            </Button>
          </div>

          {/* רשימת משימות מותאמות */}
          <AnimatePresence>
            {customTasks.map(task => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-between p-4 bg-white border rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{task.title}</h4>
                  <p className="text-sm text-gray-600">
                    {task.duration} דקות • {task.priority === 'high' ? 'עדיפות גבוהה' : task.priority === 'medium' ? 'עדיפות בינונית' : 'עדיפות נמוכה'}
                  </p>
                  {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCustomTask(task.id)}
                  className="text-amber-500 hover:text-amber-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* כפתור יצירה */}
      <div className="flex justify-center pt-6">
        <Button
          onClick={handleGenerateTasks}
          disabled={isGenerating || getTotalSelectedTasks() === 0}
          size="lg"
          className="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
              יוצר משימות...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 ml-2" />
              צור {getTotalSelectedTasks()} משימות בית ({timeEstimate.hours}:{timeEstimate.minutes.toString().padStart(2, '0')} שעות)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// קומפוננטת קטגוריה
const TaskCategoryCard = ({ categoryKey, categoryInfo, tasks, selectedTasks, onTaskSelection }) => {
  const selectedCount = Object.values(selectedTasks).filter(Boolean).length;
  const Icon = categoryInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{categoryInfo.emoji}</div>
              <div>
                <h3 className="text-xl font-bold">{categoryInfo.title}</h3>
                <Badge className={categoryInfo.color}>
                  {selectedCount}/{tasks.length} נבחרו
                </Badge>
              </div>
            </div>
            <Icon className="w-6 h-6 text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskSelectionItem
                key={task.title}
                task={task}
                isSelected={selectedTasks[task.title] || false}
                onSelectionChange={(isSelected) => onTaskSelection(categoryKey, task.title, isSelected)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// קומפוננטת בחירת משימה
const TaskSelectionItem = ({ task, isSelected, onSelectionChange }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-amber-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'גבוהה';
      case 'medium': return 'בינונית';
      case 'low': return 'נמוכה';
      default: return priority;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
      onClick={() => onSelectionChange(!isSelected)}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={isSelected} onChange={() => onSelectionChange(!isSelected)} />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{task.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.duration} דקות
            </span>
            <span className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
              <Star className="w-3 h-3" />
              עדיפות {getPriorityText(task.priority)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};