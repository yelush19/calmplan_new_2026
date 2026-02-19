import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Wrench, BatteryLow } from 'lucide-react';
import { Task } from '@/api/entities';

const FEEDBACK_OPTIONS = [
  {
    key: 'interruptions',
    label: 'הפרעות חיצוניות',
    icon: Phone,
    color: 'bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-200',
    description: 'טלפונים / בלגן',
  },
  {
    key: 'complexity',
    label: 'מורכבות טכנית',
    icon: Wrench,
    color: 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-200',
    description: 'התיק היה קשה',
  },
  {
    key: 'low_energy',
    label: 'אנרגיה נמוכה',
    icon: BatteryLow,
    color: 'bg-red-100 hover:bg-red-200 text-red-700 border-red-200',
    description: 'יום עמוס / עייפות',
  },
];

export default function CompletionFeedback() {
  const [completedTask, setCompletedTask] = useState(null);
  const [visible, setVisible] = useState(false);

  // Listen for task completion events
  useEffect(() => {
    const handler = (e) => {
      const { task } = e.detail || {};
      if (task) {
        setCompletedTask(task);
        setVisible(true);
        // Auto-hide after 5 seconds if no interaction
        setTimeout(() => {
          setVisible(false);
          setCompletedTask(null);
        }, 5000);
      }
    };
    window.addEventListener('calmplan:task-completed', handler);
    return () => window.removeEventListener('calmplan:task-completed', handler);
  }, []);

  const handleFeedback = useCallback(async (feedbackKey) => {
    if (!completedTask) return;
    try {
      // Store feedback in the task
      const existingFeedback = completedTask.completion_feedback || [];
      await Task.update(completedTask.id, {
        completion_feedback: [...existingFeedback, {
          key: feedbackKey,
          date: new Date().toISOString(),
        }],
        last_feedback: feedbackKey,
      });
    } catch { /* ignore errors */ }
    setVisible(false);
    setCompletedTask(null);
  }, [completedTask]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setCompletedTask(null);
  }, []);

  return (
    <AnimatePresence>
      {visible && completedTask && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-[360px] max-w-[calc(100vw-2rem)]"
          dir="rtl"
        >
          <div className="text-center mb-3">
            <p className="text-sm font-medium text-gray-700">מה קרה הפעם?</p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {completedTask.title}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            {FEEDBACK_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  onClick={() => handleFeedback(option.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${option.color}`}
                  title={option.description}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium whitespace-nowrap">{option.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-2 left-2 text-gray-300 hover:text-gray-500 text-sm"
          >
            &times;
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
