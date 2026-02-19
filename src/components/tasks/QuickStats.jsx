import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CheckSquare, Clock, AlertTriangle, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseISO, isToday } from "date-fns";

export default function QuickStats({ tasks, sessions, isLoading, activeFilter, onFilterSelect }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed' || task.status === 'not_relevant') return false;
    if (!task.due_date) return false;
    const d = parseISO(task.due_date);
    d.setHours(23, 59, 59, 999);
    return d < now;
  });

  const todayTasks = tasks.filter(task => {
    if (task.status === 'completed' || task.status === 'not_relevant') return false;
    if (!task.due_date) return false;
    return isToday(parseISO(task.due_date));
  });

  const stats = [
    {
      title: "הושלמו",
      value: completedTasks,
      subtitle: `מתוך ${tasks.length} משימות`,
      icon: CheckSquare,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      ringColor: "ring-emerald-400",
      filterKey: "completed"
    },
    {
      title: "סה\"כ פעילות",
      value: tasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant').length,
      subtitle: `${tasks.length} משימות בסה"כ`,
      icon: Target,
      color: "text-sky-600",
      bgColor: "bg-sky-100",
      ringColor: "ring-sky-400",
      filterKey: "all"
    },
    {
      title: "בפיגור",
      value: overdueTasks.length,
      subtitle: "דורשות תשומת לב",
      icon: AlertTriangle,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      ringColor: "ring-purple-400",
      filterKey: "overdue"
    },
    {
      title: "להיום",
      value: todayTasks.length,
      subtitle: "משימות עם דד-ליין היום",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      ringColor: "ring-amber-400",
      filterKey: "today"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const isActive = activeFilter === stat.filterKey;
        return (
          <Card
            key={index}
            className={`cursor-pointer hover:shadow-md hover:ring-2 hover:${stat.ringColor} transition-all duration-300 ${isActive ? `ring-2 ${stat.ringColor} shadow-md` : ''}`}
            onClick={() => onFilterSelect?.(stat.filterKey)}
          >
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
