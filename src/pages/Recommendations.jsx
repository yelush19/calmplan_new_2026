import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Calendar, Clock, BarChart3, CheckCircle, Zap, AlertTriangle, Target, Plus, ArrowRight } from 'lucide-react';
import { Task, Event } from '@/api/entities';
import { startOfWeek, endOfWeek, addDays, isWithinInterval, format, isBefore, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';


export default function RecommendationsPage() {
    const [tasks, setTasks] = useState([]);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [tasksData, eventsData] = await Promise.all([
                    Task.list(),
                    Event.list()
                ]);
                setTasks(tasksData || []);
                setEvents(eventsData || []);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const getWeeklyWorkload = () => {
        const today = new Date();
        const startOfNextWeek = startOfWeek(addDays(today, 7), { locale: he });
        const endOfNextWeek = endOfWeek(startOfNextWeek, { locale: he });

        const nextWeekTasks = tasks.filter(t => t.due_date && isWithinInterval(parseISO(t.due_date), { start: startOfNextWeek, end: endOfNextWeek }));
        const nextWeekEvents = events.filter(e => e.start_date && isWithinInterval(parseISO(e.start_date), { start: startOfNextWeek, end: endOfNextWeek }));

        const totalItems = nextWeekTasks.length + nextWeekEvents.length;
        let workload = "קל";
        let workloadColor = "text-green-600";
        if (totalItems > 10) {
            workload = "בינוני";
            workloadColor = "text-yellow-600";
        }
        if (totalItems > 20) {
            workload = "כבד";
            workloadColor = "text-amber-600";
        }

        return {
            count: totalItems,
            level: workload,
            color: workloadColor,
            period: `${format(startOfNextWeek, 'd/M')} - ${format(endOfNextWeek, 'd/M')}`
        };
    };

    const getUrgentTasks = () => {
        const now = new Date();
        return tasks.filter(task => {
            if (task.status === 'completed') return false;
            if (task.priority === 'urgent') return true;
            if (task.due_date && isBefore(parseISO(task.due_date), addDays(now, 2))) return true;
            return false;
        });
    };

    const getCompletedToday = () => {
        const today = new Date().toDateString();
        return tasks.filter(task => 
            task.completed_date && 
            new Date(task.completed_date).toDateString() === today
        );
    };

    const getUnscheduledImportantTasks = () => {
        return tasks.filter(task => 
            task.status !== 'completed' && 
            task.importance === 'high' && 
            !task.scheduled_start &&
            !task.planned_date
        );
    };

    const createFocusBlock = async (timeSlot) => {
        try {
            const today = new Date();
            const [startHour, endHour] = timeSlot.split('-');
            
            const startDate = new Date(today);
            startDate.setHours(parseInt(startHour.split(':')[0]), parseInt(startHour.split(':')[1]), 0);
            
            const endDate = new Date(today);
            endDate.setHours(parseInt(endHour.split(':')[0]), parseInt(endHour.split(':')[1]), 0);

            await Event.create({
                title: "בלוק ריכוז מומלץ",
                description: "זמן מוקדש לעבודה על משימות חשובות ללא הפרעות",
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                category: "work",
                priority: "high",
                importance: "high"
            });

            alert("בלוק הריכוז נקבע בהצלחה!");
            navigate(createPageUrl("Calendar"));
        } catch (error) {
            console.error("שגיאה ביצירת בלוק ריכוז:", error);
            alert("שגיאה ביצירת בלוק הריכוז");
        }
    };

    const scheduleImportantTasks = () => {
        navigate(createPageUrl("TaskMatrix"));
    };

    const getDailyFocusBlocks = () => {
        const morningBlock = { 
            time: "09:00-11:00", 
            suggestion: "עבודה על משימה בעלת חשיבות גבוהה",
            action: () => createFocusBlock("09:00-11:00")
        };
        const afternoonBlock = { 
            time: "14:00-15:30", 
            suggestion: "טיפול במיילים ומשימות אדמיניסטרטיביות",
            action: () => createFocusBlock("14:00-15:30")
        };
        return [morningBlock, afternoonBlock];
    };

    const getSmartRecommendations = () => {
        const recs = [];
        const urgentTasks = getUrgentTasks();
        const completedToday = getCompletedToday();
        const unscheduledImportant = getUnscheduledImportantTasks();
        
        if (urgentTasks.length > 0) {
            recs.push({
                type: "urgent",
                icon: AlertTriangle,
                title: `יש לך ${urgentTasks.length} משימות דחופות`,
                description: "מומלץ לטפל בהן עד סוף היום",
                action: "הצג משימות דחופות",
                actionType: "navigate",
                target: "Tasks",
                onClick: () => navigate(createPageUrl("Tasks"))
            });
        }

        if (unscheduledImportant.length > 0) {
            recs.push({
                type: "planning",
                icon: Calendar,
                title: `${unscheduledImportant.length} משימות חשובות לא מתוכננות`,
                description: "תכנן מתי לבצע אותן כדי להבטיח שהן יבוצעו",
                action: "תכנן במטריצה",
                actionType: "schedule",
                onClick: scheduleImportantTasks
            });
        }

        if (completedToday.length < 3) {
            recs.push({
                type: "productivity",
                icon: Target,
                title: "קבע יעד יומי",
                description: "נסה להשלים לפחות 3 משימות היום",
                action: "הוסף משימה חדשה",
                actionType: "create",
                onClick: () => navigate(createPageUrl("Tasks"))
            });
        }

        if (completedToday.length >= 5) {
            recs.push({
                type: "celebration",
                icon: CheckCircle,
                title: "כל הכבוד!",
                description: `השלמת כבר ${completedToday.length} משימות היום`,
                action: "המשך כך!",
                actionType: "celebrate"
            });
        }

        return recs;
    };
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600">טוען המלצות חכמות...</p>
                </div>
            </div>
        );
    }

    const workload = getWeeklyWorkload();
    const focusBlocks = getDailyFocusBlocks();
    const smartRecommendations = getSmartRecommendations();
    const urgentTasks = getUrgentTasks();
    const completedToday = getCompletedToday();

    return (
        <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-neutral-dark">מרכז ההמלצות החכם</h1>
                <p className="text-xl text-neutral-medium mt-2">תובנות חכמות וניתנות ליישום למיקסום היעילות שלך</p>
            </motion.div>

            {/* המלצות חכמות ופעילות */}
            {smartRecommendations.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-500" />
                        המלצות מותאמות אישית
                    </h2>
                    <div className="grid gap-4">
                        {smartRecommendations.map((rec, index) => (
                            <Card key={index} className={`${
                                rec.type === 'urgent' ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' :
                                rec.type === 'celebration' ? 'border-green-300 bg-green-50 hover:bg-green-100' :
                                rec.type === 'planning' ? 'border-purple-300 bg-purple-50 hover:bg-purple-100' :
                                'border-blue-300 bg-blue-50 hover:bg-blue-100'
                            } transition-all duration-200 cursor-pointer hover:shadow-lg`}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                                rec.type === 'urgent' ? 'bg-amber-200' :
                                                rec.type === 'celebration' ? 'bg-green-200' :
                                                rec.type === 'planning' ? 'bg-purple-200' :
                                                'bg-blue-200'
                                            }`}>
                                                <rec.icon className={`w-6 h-6 ${
                                                    rec.type === 'urgent' ? 'text-amber-600' :
                                                    rec.type === 'celebration' ? 'text-green-600' :
                                                    rec.type === 'planning' ? 'text-purple-600' :
                                                    'text-blue-600'
                                                }`} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800">{rec.title}</h3>
                                                <p className="text-gray-600">{rec.description}</p>
                                            </div>
                                        </div>
                                        {rec.action && rec.onClick && (
                                            <Button 
                                                onClick={rec.onClick}
                                                className={`${
                                                    rec.type === 'urgent' ? 'bg-amber-500 hover:bg-amber-600' :
                                                    rec.type === 'celebration' ? 'bg-green-500 hover:bg-green-600' :
                                                    rec.type === 'planning' ? 'bg-purple-500 hover:bg-purple-600' :
                                                    'bg-blue-500 hover:bg-blue-600'
                                                } text-white`}
                                            >
                                                {rec.action}
                                                <ArrowRight className="w-4 h-4 me-2" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                <Card className="hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Calendar className="text-blue-500" /> 
                            עומס שבועי צפוי
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-2">שבוע הבא ({workload.period})</p>
                        <p className={`text-3xl font-bold ${workload.color}`}>{workload.level}</p>
                        <p className="text-gray-700">{workload.count} משימות ואירועים</p>
                        {workload.count > 15 && (
                            <div className="mt-3 p-2 bg-amber-50 rounded-lg">
                                <p className="text-sm text-amber-700">💡 שקול לדחות משימות פחות חשובות</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Clock className="text-green-500" /> 
                            הצעות לבלוקי ריכוז
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {focusBlocks.map((block, i) => (
                            <div key={i} className="p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-green-800">{block.time}</p>
                                        <p className="text-sm text-green-600">{block.suggestion}</p>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        onClick={block.action}
                                        className="bg-green-500 hover:bg-green-600 text-white"
                                    >
                                        <Plus className="w-4 h-4 ms-1" />
                                        קבע
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <CheckCircle className="text-purple-500" /> 
                            מצב היום
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-2">
                           <p className="flex items-center gap-2">
                               ✅ <span className="font-semibold">{completedToday.length}</span> משימות הושלמו
                           </p>
                           <p className="flex items-center gap-2">
                               ⏰ <span className={`font-semibold ${urgentTasks.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                   {urgentTasks.length}
                               </span> משימות דחופות
                           </p>
                           <p className="flex items-center gap-2">
                               📋 <span className="font-semibold">{tasks.filter(t => t.status !== 'completed').length}</span> משימות פעילות
                           </p>
                       </div>
                       
                       {completedToday.length >= 3 && (
                           <div className="mt-4 p-3 bg-green-50 rounded-lg">
                               <p className="text-sm text-green-700 font-semibold">🎉 יום פרודוקטיביי!</p>
                           </div>
                       )}
                    </CardContent>
                </Card>
            </div>

            {/* סיכום וטיפים */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="bg-gradient-to-l from-emerald-50 to-blue-50 border-emerald-200">
                    <CardContent className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Lightbulb className="w-6 h-6 text-emerald-600" />
                            טיפים לשבוע הקרוב
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4 text-gray-700">
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <span className="text-emerald-600 font-bold">1.</span>
                                    <p className="text-sm">תכנן את 3 המשימות החשובות ביותר מדי בוקר</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-emerald-600 font-bold">2.</span>
                                    <p className="text-sm">הקדש לפחות שעתיים ביום לעבודה ללא הפרעות</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <span className="text-emerald-600 font-bold">3.</span>
                                    <p className="text-sm">בדוק את לוח הזמנים מדי ערב ותכנן את המחר</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-emerald-600 font-bold">4.</span>
                                    <p className="text-sm">קח הפסקות קצרות כל שעה לשמירה על הריכוז</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}