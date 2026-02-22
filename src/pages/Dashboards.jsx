import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Task, Event } from '@/api/entities';
import { CheckCircle, Clock, TrendingUp, Users, Briefcase, Home } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardsPage() {
    const [data, setData] = useState({
        taskStatus: [],
        tasksByCategory: [],
        weeklyCompletion: [],
        workVsHome: [],
        stats: {
            completed: 0,
            pending: 0,
            avgCompletionTime: 0
        }
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        const [tasks, events] = await Promise.all([Task.list(), Event.list()]);

        // Task Status
        const taskStatus = tasks.reduce((acc, task) => {
            const status = task.status || 'not_started';
            const existing = acc.find(item => item.name === status);
            if (existing) {
                existing.value += 1;
            } else {
                acc.push({ name: status, value: 1 });
            }
            return acc;
        }, []);

        // Tasks by Category (work/home)
        const workVsHome = tasks.reduce((acc, task) => {
            const context = task.context || 'work';
            const existing = acc.find(item => item.name === context);
            if (existing) {
                existing.value += 1;
            } else {
                acc.push({ name: context, value: 1 });
            }
            return acc;
        }, []);
        
        // Weekly completion
        const weeklyCompletion = Array(7).fill(0).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = d.toLocaleDateString('he-IL', { weekday: 'short' });
            return { name: dayName, completed: 0 };
        }).reverse();

        tasks.filter(t => t.status === 'completed' && t.completed_date).forEach(task => {
            const completedDate = new Date(task.completed_date);
            const today = new Date();
            const diffDays = Math.floor((today - completedDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                const dayIndex = 6 - diffDays;
                weeklyCompletion[dayIndex].completed += 1;
            }
        });

        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = tasks.length - completed;
        
        const completedWithTime = tasks.filter(t => t.status === 'completed' && t.actual_minutes);
        const totalMinutes = completedWithTime.reduce((sum, t) => sum + t.actual_minutes, 0);
        const avgCompletionTime = completedWithTime.length > 0 ? Math.round(totalMinutes / completedWithTime.length) : 0;

        setData({
            taskStatus,
            tasksByCategory: [], // placeholder for more detailed categories
            weeklyCompletion,
            workVsHome: workVsHome.map(item => ({...item, name: item.name === 'work' ? 'עבודה' : 'בית' })),
            stats: { completed, pending, avgCompletionTime }
        });
        setIsLoading(false);
    };

    if (isLoading) {
        return <div className="p-8 text-center">טוען נתונים...</div>
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 sm:p-6 md:p-8 bg-gray-50"
        >
            <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">דשבורד ניתוח נתונים</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">משימות שהושלמו</CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.completed}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">משימות פתוחות</CardTitle>
                        <Clock className="w-4 h-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.pending}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">זמן ממוצע למשימה (דקות)</CardTitle>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.avgCompletionTime}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>השלמת משימות שבועית</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.weeklyCompletion}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="completed" fill="#8884d8" name="הושלמו" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>סטטוס משימות</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={data.taskStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {data.taskStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>חלוקת משימות: בית vs עבודה</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={data.workVsHome} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#82ca9d" label>
                                     <Cell key="cell-0" fill="#0088FE" />
                                     <Cell key="cell-1" fill="#00C49F" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

        </motion.div>
    );
}