import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Clock, Target, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuickStats({ tasks, sessions, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const totalTimeSpent = sessions.reduce((total, session) => total + (session.duration_minutes || 0), 0);
  const avgProductivity = sessions.length > 0 
    ? sessions.reduce((sum, session) => sum + (session.productivity_rating || 0), 0) / sessions.length 
    : 0;
  const plannedTasks = tasks.filter(task => task.was_planned).length;
  const unplannedCompleted = tasks.filter(task => task.status === 'completed' && !task.was_planned).length;

  const stats = [
    {
      title: "משימות הושלמו",
      value: completedTasks,
      subtitle: `מתוך ${tasks.length} משימות`,
      icon: CheckSquare,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "זמן כולל",
      value: `${Math.round(totalTimeSpent / 60)}:${(totalTimeSpent % 60).toString().padStart(2, '0')}`,
      subtitle: "שעות עבודה",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "פרודוקטיביות ממוצעת",
      value: avgProductivity.toFixed(1),
      subtitle: "מתוך 5.0",
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "משימות לא מתוכננות",
      value: unplannedCompleted,
      subtitle: `${tasks.length - plannedTasks} לא תוכננו`,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow duration-300">
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}