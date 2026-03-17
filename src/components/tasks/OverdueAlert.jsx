import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';

export default function OverdueAlert({ tasks }) {
  const overdueTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return differenceInDays(today, dueDate) > 0;
  });

  if (overdueTasks.length === 0) return null;

  const criticalOverdue = overdueTasks.filter(task => {
    const daysOverdue = differenceInDays(new Date(), new Date(task.due_date));
    return daysOverdue > 3;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className="border border-sky-200 bg-sky-50/60">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Subtle pulsing dot instead of screaming icon */}
            <div className="relative flex-shrink-0">
              <Clock className="w-5 h-5 text-sky-600" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-sky-800 text-sm">
                {overdueTasks.length} משימות ממתינות לטיפול
              </h3>
              {criticalOverdue.length > 0 && (
                <p className="text-xs text-sky-600 mt-0.5">
                  {criticalOverdue.length} מהן דורשות תשומת לב (מעל 3 ימים)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
