import React from 'react';
import { motion } from 'framer-motion';
import ClientRecurringTasks from '@/components/clients/ClientRecurringTasks';

export default function RecurringTasksPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          משימות חוזרות
        </h1>
        <p className="text-gray-500">
          יצירה אוטומטית של משימות חוזרות לכל הלקוחות הפעילים
        </p>
      </div>

      <ClientRecurringTasks />
    </motion.div>
  );
}
