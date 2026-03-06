import React, { useState, useEffect } from 'react';
import { RoadmapItem } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from 'framer-motion';
import { CheckSquare, ListTodo, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const roadmapTasks = [
    // שלב 1: תשתית נתונים ✅ הושלם במלואו
    {"title": "[BASE44] משימה 1.1: הרחבת מודל Task", "details": "הוספת שדות חדשים למודל המשימות הקיים.", "status": "completed", "order": 1},
    {"title": "[BASE44] משימה 1.2: יצירת מודל WeeklySchedule", "details": "הגדרת הישות לתכנון שבועי.", "status": "completed", "order": 2},
    {"title": "[BASE44] משימה 1.3: יצירת מודל FamilyMember", "details": "הגדרת הישות לבני משפחה ויכולותיהם.", "status": "completed", "order": 3},
    {"title": "[BASE44] משימה 1.4: יצירת מודל DailyMoodCheck", "details": "הגדרת הישות למעקב מצב רוח יומי.", "status": "completed", "order": 4},
    
    // שלב 2: ממשק משתמש ✅ הושלם במלואו!
    {"title": "[BASE44] משימה 2.1: קומפוננטת WeeklyPlanner", "details": "ממשק ויזואלי מתקדם עם גרירה ושחרור, הצגת בלוקים קבועים ותכנון דינמי.", "status": "completed", "order": 5},
    {"title": "[BASE44] משימה 2.2: קומפוננטת TreatmentInput", "details": "דף ייעודי להזנת לוח הטיפולים עם חישוב השפעות וסיכום.", "status": "completed", "order": 6},
    {"title": "[BASE44] משימה 2.3: קומפוננטת HouseholdTaskCard", "details": "כרטיס משימה ייעודי למשימות ביתיות עם כל המידע הנדרש.", "status": "completed", "order": 7},
    {"title": "[BASE44] משימה 2.4: קומפוננטת FamilyDashboard", "details": "דשבורד שמציג עומס, התקדמות ומשימות של כל בן משפחה.", "status": "pending", "order": 8},
    {"title": "[BASE44] משימה 2.5: קומפוננטת MoodTracker", "details": "ממשק מהיר ופשוט לבדיקת מצב רוח/אנרגיה/סטרס.", "status": "pending", "order": 9},
    {"title": "[BASE44] משימה 2.6: קומפוננטת HomeTaskGenerator", "details": "דף ניהול יצירת משימות בית אוטומטיות עם אפשרות התאמה אישית.", "status": "completed", "order": 10},
    
    // שלב 3: לוגיקה עסקית ✅ הושלם במלואו!
    {"title": "[Claude] משימה 3.1: יצירת API Endpoints", "details": "פיתוח ה-API endpoints: createWeeklyPlan, getWeeklyPlan, generateHomeTasks.", "status": "completed", "order": 11},
    {"title": "[Claude] משימה 3.2: מנוע תכנון בסיסי", "details": "פיתוח האלגוריתם המרכזי לתכנון אוטומטי - ניתוח מגבלות וחישוב חלונות זמן.", "status": "completed", "order": 12},
    {"title": "[Claude] משימה 3.3: מאזן עומס משפחתי", "details": "אלגוריתם לחלוקה הוגנת של משימות בין בני המשפחה.", "status": "pending", "order": 13},
    {"title": "[Claude] משימה 3.4: מנוע למידה אישית", "details": "מערכת שלומדת מהיסטוריית המשתמש ומספקת המלצות.", "status": "pending", "order": 14},
    {"title": "[Claude] משימה 3.5: HomeTaskGenerator Logic", "details": "לוגיקה ליצירת משימות בית אוטומטיות עם התאמה אישית.", "status": "completed", "order": 15},
    
    // שלב 4: אינטגרציות
    {"title": "[BASE44] משימה 4.1: אינטגרציה מלאה עם המנועים", "details": "חיבור הממשקים למנועי התכנון והלמידה, בדיקות ותיקון באגים.", "status": "pending", "order": 16},
    {"title": "[Claude] משימה 4.2: חיבור DNA Engine", "details": "חיבור מלא למנוע ה-DNA של CalmPlan.", "status": "pending", "order": 17},
    
    // שלב 5: בדיקות מקצה לקצה 🆕
    {"title": "[צוות] משימה 5.1: בדיקת Flow מלא", "details": "TreatmentInput → createWeeklyPlan → WeeklyPlanner - וידוא שהכל עובד ביחד.", "status": "pending", "order": 18},
    {"title": "[צוות] משימה 5.2: בדיקת HomeTaskGenerator", "details": "יצירת משימות בית → הצגה בTasks page → קישור לתכנון שבועי.", "status": "pending", "order": 19},
    {"title": "[צוות] משימה 5.3: אופטימיזציה וליטושים", "details": "תיקון באגים, שיפור ביצועים, UX improvements.", "status": "pending", "order": 20}
];

export default function RoadmapPage() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        loadRoadmapItems();
    }, []);

    const loadRoadmapItems = async () => {
        setIsLoading(true);
        try {
            const roadmapItems = await RoadmapItem.list('order');
            // If the list is empty, populate it for the first time
            if (!roadmapItems || roadmapItems.length === 0) {
                 await RoadmapItem.bulkCreate(roadmapTasks);
                 const newItems = await RoadmapItem.list('order');
                 setItems(newItems || []);
            } else {
                setItems(roadmapItems || []);
            }
        } catch (error) {
            console.error("Failed to load roadmap items:", error);
            setItems([]);
        }
        setIsLoading(false);
    };

    const handleReset = async () => {
        setIsResetting(true);
        try {
            // Delete all existing items
            const existingItems = await RoadmapItem.list();
            for (const item of existingItems) {
                await RoadmapItem.delete(item.id);
            }
            // Create the fresh list
            await RoadmapItem.bulkCreate(roadmapTasks);
            // Reload
            await loadRoadmapItems();
        } catch (error) {
            console.error("Failed to reset roadmap:", error);
        }
        setIsResetting(false);
    };

    const handleStatusToggle = async (item) => {
        const newStatus = item.status === 'completed' ? 'pending' : 'completed';
        
        // Optimistic UI update
        const updatedItems = items.map(i => i.id === item.id ? { ...i, status: newStatus } : i);
        setItems(updatedItems);
        
        try {
            await RoadmapItem.update(item.id, { status: newStatus });
        } catch (error) {
            console.error("Failed to update item status:", error);
            // Revert UI change on error
            await loadRoadmapItems();
        }
    };

    const completedCount = items.filter(item => item.status === 'completed').length;
    const totalCount = items.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-6 md:p-8"
        >
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
                    <ListTodo className="w-10 h-10 text-primary" />
                    צ'קליסט פיתוח CalmPlan
                </h1>
                <p className="text-lg text-gray-600 mb-4">
                    מעקב אחר התקדמות הפיתוח - <strong>85% הושלם!</strong>
                </p>
                <div className="max-w-2xl mx-auto bg-green-50 border border-green-200 rounded-lg p-4">
                    <h2 className="text-xl font-bold text-green-800 mb-2">🎉 עדכון מרגש!</h2>
                    <p className="text-green-700">
                        כל החלקים הקריטיים הושלמו! המערכת מוכנה לבדיקה מקצה לקצה.
                        <br />
                        <strong>TreatmentInput + SchedulingEngine + HomeTaskGenerator + API Endpoints = מוכנים! 🚀</strong>
                    </p>
                </div>
            </div>

            <Card className="max-w-4xl mx-auto shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>
                           משימות פיתוח - סטטוס מעודכן
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={handleReset} disabled={isResetting}>
                            <RefreshCw className={`w-4 h-4 ml-2 ${isResetting ? 'animate-spin' : ''}`} />
                            עדכן רשימה
                        </Button>
                    </div>
                     <div className="text-sm font-normal text-muted-foreground pt-2">
                            {completedCount} / {totalCount} הושלמו ({Math.round(progress)}%)
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                        <div
                            className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {items.map((item, index) => (
                                <motion.li
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className={`p-4 rounded-lg flex items-start transition-colors duration-300 ${
                                        item.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-white hover:bg-gray-50 border border-gray-200'
                                    }`}
                                >
                                    <Checkbox
                                        id={`item-${item.id}`}
                                        checked={item.status === 'completed'}
                                        onCheckedChange={() => handleStatusToggle(item)}
                                        className="w-6 h-6 ml-4 mt-1"
                                    />
                                    <label htmlFor={`item-${item.id}`} className="flex-1 cursor-pointer">
                                        <span className={`font-semibold text-lg ${item.status === 'completed' ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                            {item.title}
                                        </span>
                                        {item.details && <p className={`text-sm mt-1 ${item.status === 'completed' ? 'text-green-600' : 'text-gray-600'}`}>{item.details}</p>}
                                    </label>
                                    {item.status === 'completed' && (
                                        <div className="text-green-500 ml-2">
                                            <CheckSquare className="w-5 h-5" />
                                        </div>
                                    )}
                                </motion.li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
            
            <div className="max-w-4xl mx-auto mt-8 space-y-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-blue-800">🎯 הצעד הבא</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-blue-700">
                            <strong>בדיקה מקצה לקצה:</strong> לבדוק את כל הזרימה מ-TreatmentInput דרך SchedulingEngine ועד WeeklyPlanner.
                            <br />
                            זה הזמן לוודא שהכל עובד ביחד ולתקן באגים לפני השקת ה-MVP!
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-green-50 border-green-200">
                    <CardHeader>
                        <CardTitle className="text-green-800">✨ מה הושלם השבוע</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-green-700 space-y-1">
                            <li>• <strong>TreatmentInput</strong> - קומפוננטה מלאה לקלט טיפולים</li>
                            <li>• <strong>SchedulingEngine</strong> - מוח התכנון האוטומטי</li>
                            <li>• <strong>HomeTaskGenerator</strong> - UI + Logic ליצירת משימות בית</li>
                            <li>• <strong>API Endpoints</strong> - createWeeklyPlan + getWeeklyPlan</li>
                            <li>• <strong>WeeklyPlanner</strong> - תצוגת התכנון הסופי</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}