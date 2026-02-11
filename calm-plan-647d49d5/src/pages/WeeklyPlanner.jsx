import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Task, WeeklySchedule } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { AlertTriangle, Calendar, Check, Clock, Edit, Home, Briefcase, Loader, ServerCrash, ArrowRight } from 'lucide-react';
import { getWeeklyPlan } from '@/api/functions';
import { createPageUrl } from '@/utils';

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const priorityColors = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-400 text-white',
  medium: 'bg-yellow-400 text-black',
  low: 'bg-blue-400 text-white',
};

const contextIcons = {
    work: <Briefcase className="w-4 h-4" />,
    home: <Home className="w-4 h-4" />
};

const UrgentTaskItem = ({ task }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -10 }}
    className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-red-500"
  >
    <div className="flex justify-between items-start">
        <div className="flex-grow">
            <h4 className="font-semibold text-gray-800">{task.title}</h4>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span className={`p-1 rounded ${task.context === 'work' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    {contextIcons[task.context]}
                </span>
                <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                {task.due_date && (
                    <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3"/>
                        <span>יעד: {format(parseISO(task.due_date), 'dd/MM/yy')}</span>
                    </div>
                )}
            </div>
        </div>
    </div>
  </motion.div>
);

const ScheduledItem = ({ item }) => {
    const isTask = !!item.task;
    const itemColor = isTask ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200';
    const title = isTask ? item.task.title : item.notes;

    return (
        <div className={`p-3 rounded-md ${itemColor}`}>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-gray-600">{item.startTime} - {item.endTime}</p>
            {!isTask && <p className="text-xs text-gray-500">{item.location}</p>}
        </div>
    );
};

export default function WeeklyPlannerPage() {
    const [searchParams] = useSearchParams();
    const weekStartDateStr = searchParams.get('weekStartDate');
    
    const [plan, setPlan] = useState(null);
    const [urgentTasks, setUrgentTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!weekStartDateStr) {
            setError('לא צוין תאריך התחלה של השבוע.');
            setIsLoading(false);
            return;
        }
        loadData(weekStartDateStr);
    }, [weekStartDateStr]);

    const loadData = async (startDate) => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch generated plan
            const planResponse = await getWeeklyPlan({ weekStartDate: startDate });
            if (planResponse.data.success) {
                setPlan(planResponse.data.weeklySchedule);
            } else {
                throw new Error(planResponse.data.error || 'נכשל בטעינת התכנון השבועי.');
            }

            // Fetch tasks for urgent panel
            const reportingCategories = ['work_vat_reporting', 'work_tax_advances', 'work_deductions', 'work_social_security', 'work_payroll'];
            const deadlineDate = addDays(new Date(startDate), 14);

            const [urgentPriorityTasks, upcomingDeadlineTasks] = await Promise.all([
                Task.filter({ priority: 'urgent', status_ne: 'completed' }),
                Task.filter({
                    category: { 'in': reportingCategories },
                    due_date: { '<=': format(deadlineDate, 'yyyy-MM-dd'), '>=': format(new Date(), 'yyyy-MM-dd') },
                    status_ne: 'completed'
                })
            ]);

            const allUrgent = [...(urgentPriorityTasks || []), ...(upcomingDeadlineTasks || [])];
            const uniqueUrgentTasks = Array.from(new Map(allUrgent.map(task => [task.id, task])).values())
                                          .sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
            setUrgentTasks(uniqueUrgentTasks);
        } catch (err) {
            setError(err.message);
            console.error(err);
        }
        setIsLoading(false);
    };
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen"><Loader className="w-12 h-12 animate-spin text-primary" /> <p className="ml-4 text-lg">טוען תכנון שבועי...</p></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center">
                <ServerCrash className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">אופס, משהו השתבש</h2>
                <p className="text-red-600 mb-4">{error}</p>
                <Link to={createPageUrl("TreatmentInput")}>
                    <Button>
                        <ArrowRight className="w-4 h-4 ml-2" />
                        חזור ליצירת תכנון
                    </Button>
                </Link>
            </div>
        );
    }
    
    const weekStartDate = new Date(weekStartDateStr.replace(/-/g, '/'));

    return (
        <div className="p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            תכנון שבועי: {format(weekStartDate, 'dd/MM')} - {format(addDays(weekStartDate, 6), 'dd/MM/yyyy')}
                        </CardTitle>
                    </CardHeader>
                </Card>
                {daysOfWeek.slice(0, 5).map((dayName, dayIndex) => {
                    const dayDate = addDays(weekStartDate, dayIndex);
                    const itemsForDay = plan?.scheduledTasks?.filter(item => item.day === dayIndex) || [];
                    const fixedBlocksForDay = plan?.fixedBlocks?.filter(item => item.day === dayIndex) || [];
                    const allDayItems = [...itemsForDay, ...fixedBlocksForDay].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

                    return (
                        <Card key={dayIndex}>
                            <CardHeader>
                                <CardTitle className="text-lg">{dayName}, {format(dayDate, 'dd/MM')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {allDayItems.length > 0 ? (
                                    allDayItems.map((item, i) => <ScheduledItem key={item.taskId || `fixed-${i}`} item={item} />)
                                ) : (
                                    <p className="text-gray-500 text-center py-4">יום פנוי</p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="space-y-6 sticky top-6">
                <Card className="bg-red-50 border-red-200 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-6 h-6" />
                            משימות דחופות לטיפול
                        </CardTitle>
                        <p className="text-sm text-red-600">רשימה זו מורכבת אוטומטית ממשימות עם עדיפות "דחופה" ודדליינים קרובים.</p>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
                        <AnimatePresence>
                            {urgentTasks.length > 0 ? (
                                urgentTasks.map(task => <UrgentTaskItem key={task.id} task={task} />)
                            ) : (
                                <p className="text-center text-gray-500 py-4">אין משימות דחופות כרגע. כל הכבוד!</p>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}