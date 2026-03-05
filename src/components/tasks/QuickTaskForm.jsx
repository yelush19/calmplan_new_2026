import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from "@/api/entities";
import { X, Save, AlertTriangle, Star, ArrowUp, ArrowDown } from "lucide-react";

export default function QuickTaskForm({ quadrant, onClose, onSave }) {
  const [task, setTask] = useState({
    title: "",
    description: "",
    category: "work",
    estimated_minutes: 15,
    // Set priority and importance based on quadrant
    priority: getDefaultPriority(quadrant),
    importance: getDefaultImportance(quadrant)
  });

  const [isLoading, setIsLoading] = useState(false);

  function getDefaultPriority(quadrant) {
    switch(quadrant) {
      case 'urgent_important':
      case 'urgent_not_important':
        return 'urgent';
      default:
        return 'medium';
    }
  }

  function getDefaultImportance(quadrant) {
    switch(quadrant) {
      case 'urgent_important':
      case 'important_not_urgent':
        return 'high';
      default:
        return 'medium';
    }
  }

  function getQuadrantInfo(quadrant) {
    switch(quadrant) {
      case 'urgent_important':
        return {
          title: "עשה מיד",
          subtitle: "דחוף + חשוב",
          icon: AlertTriangle,
          color: "bg-amber-50 border-amber-200",
          advice: "משימה קריטית שדורשת טיפול מיידי"
        };
      case 'important_not_urgent':
        return {
          title: "תכנן",
          subtitle: "חשוב + לא דחוף", 
          icon: Star,
          color: "bg-green-50 border-green-200",
          advice: "משימה חשובה לתכנון מוקדם - הרבע הטוב ביותר"
        };
      case 'urgent_not_important':
        return {
          title: "האצל",
          subtitle: "דחוף + לא חשוב",
          icon: ArrowUp,
          color: "bg-yellow-50 border-yellow-200", 
          advice: "שקול האצלה או מציאת דרכים יעילות יותר"
        };
      case 'not_urgent_not_important':
        return {
          title: "בטל",
          subtitle: "לא דחוף + לא חשוב",
          icon: ArrowDown,
          color: "bg-gray-50 border-gray-200",
          advice: "שקול האם משימה זו באמת נחוצה"
        };
      default:
        return {
          title: "משימה חדשה",
          subtitle: "",
          icon: Star,
          color: "bg-blue-50 border-blue-200",
          advice: ""
        };
    }
  }

  const quadrantInfo = getQuadrantInfo(quadrant);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await Task.create(task);
      onSave();
    } catch (error) {
      console.error("שגיאה ביצירת משימה:", error);
      alert("שגיאה ביצירת המשימה");
    }
    
    setIsLoading(false);
  };

  const categories = [
    { value: "work", label: "עבודה" },
    { value: "personal", label: "אישי" },
    { value: "health", label: "בריאות" },
    { value: "learning", label: "למידה" },
    { value: "admin", label: "אדמיניסטרציה" },
    { value: "creative", label: "יצירה" }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className={`shadow-2xl bg-white ${quadrantInfo.color}`}>
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <quadrantInfo.icon className="w-8 h-8" />
              <div>
                <div className="font-bold">{quadrantInfo.title}</div>
                <div className="text-sm font-normal text-[#37474F]">{quadrantInfo.subtitle}</div>
              </div>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-6 h-6" />
            </Button>
          </CardHeader>
          
          <CardContent className="p-6">
            {quadrantInfo.advice && (
              <div className="mb-6 p-4 bg-[#F5F5F5] rounded-lg border">
                <p className="text-sm text-[#263238]">💡 <strong>טיפ:</strong> {quadrantInfo.advice}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  placeholder="כותרת המשימה..."
                  value={task.title}
                  onChange={(e) => setTask({...task, title: e.target.value})}
                  className="text-lg font-medium"
                  required
                />
              </div>
              
              <div>
                <Textarea
                  placeholder="תיאור המשימה (אופציונלי)..."
                  value={task.description}
                  onChange={(e) => setTask({...task, description: e.target.value})}
                  className="h-20"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">קטגוריה</label>
                  <Select 
                    value={task.category} 
                    onValueChange={(value) => setTask({...task, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">זמן משוער (דקות)</label>
                  <Input
                    type="number"
                    value={task.estimated_minutes}
                    onChange={(e) => setTask({...task, estimated_minutes: parseInt(e.target.value)})}
                    min="5"
                    step="5"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  ביטול
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !task.title}
                  className="flex-1 bg-primary-green hover:bg-primary-dark"
                >
                  {isLoading ? (
                    'שומר...'
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      הוסף למטריצה
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}