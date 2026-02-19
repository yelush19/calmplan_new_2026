import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';
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
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-800">
                יש לך {overdueTasks.length} משימות באיחור
              </h3>
              {criticalOverdue.length > 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  {criticalOverdue.length} מהן באיחור קריטי (מעל 3 ימים)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}