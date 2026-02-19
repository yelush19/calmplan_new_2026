import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { Task } from '@/api/entities';

// Zero-Panic Green for success
const GREEN = '#2E7D32';

const SIZE_OPTIONS = [
  { key: 'S', label: 'קל', emoji: '🟢', description: 'מהיר וחלק', color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' },
  { key: 'M', label: 'בינוני', emoji: '🔵', description: 'כצפוי', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'L', label: 'כבד', emoji: '🟣', description: 'מורכב מהצפוי', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
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
        // Auto-hide after 4 seconds if no interaction
        setTimeout(() => {
          setVisible(false);
          setCompletedTask(null);
        }, 4000);
      }
    };
    window.addEventListener('calmplan:task-completed', handler);
    return () => window.removeEventListener('calmplan:task-completed', handler);
  }, []);

  const handleSizeFeedback = useCallback(async (sizeKey) => {
    if (!completedTask) return;
    try {
      // Store the feedback to adjust future complexity estimates
      await Task.update(completedTask.id, {
        actual_complexity: sizeKey,
        completion_feedback: [
          ...(completedTask.completion_feedback || []),
          {
            key: `size_${sizeKey}`,
            actual_size: sizeKey,
            estimated_size: completedTask.client_size || 'M',
            date: new Date().toISOString(),
          },
        ],
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
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-[340px] max-w-[calc(100vw-2rem)]"
          dir="rtl"
        >
          <div className="text-center mb-3">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5" style={{ color: GREEN }} />
              <p className="text-sm font-bold" style={{ color: GREEN }}>הושלם!</p>
            </div>
            <p className="text-[11px] text-gray-500 truncate">
              {completedTask.title}
            </p>
            <p className="text-xs font-medium text-gray-700 mt-2">איך היה? מה המורכבות בפועל?</p>
          </div>
          <div className="flex gap-2 justify-center">
            {SIZE_OPTIONS.map(option => (
              <button
                key={option.key}
                onClick={() => handleSizeFeedback(option.key)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all flex-1 ${option.color}`}
                title={option.description}
              >
                <span className="text-xl">{option.emoji}</span>
                <span className="text-sm font-bold">{option.key}</span>
                <span className="text-[10px] font-medium">{option.label}</span>
              </button>
            ))}
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
