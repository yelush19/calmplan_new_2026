import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Task } from '@/api/entities';

// T-Shirt Size to max duration in minutes
const SIZE_DURATION_MAP = {
  S: 15,
  M: 60,
  L: 120,
  XL: 180,
};

export default function RealityCheck() {
  const [activeTask, setActiveTask] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Listen for task-start events (dispatched from KanbanView or task status changes)
  useEffect(() => {
    const handler = (e) => {
      const { task } = e.detail || {};
      if (task && task.status === 'in_progress') {
        setActiveTask(task);
        setStartTime(Date.now());
        setShowAlert(false);
      }
    };
    window.addEventListener('calmplan:task-started', handler);
    return () => window.removeEventListener('calmplan:task-started', handler);
  }, []);

  // Listen for task-completed events to clear the timer
  useEffect(() => {
    const handler = () => {
      setActiveTask(null);
      setStartTime(null);
      setShowAlert(false);
    };
    window.addEventListener('calmplan:task-completed', handler);
    return () => window.removeEventListener('calmplan:task-completed', handler);
  }, []);

  // Check elapsed time periodically
  useEffect(() => {
    if (!activeTask || !startTime) return;

    const maxDuration = activeTask.estimated_duration || SIZE_DURATION_MAP[activeTask.client_size || 'M'] || 60;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / (1000 * 60));
      setElapsedMinutes(elapsed);
      if (elapsed >= maxDuration && !showAlert) {
        setShowAlert(true);
      }
    }, 30000); // check every 30 seconds

    return () => clearInterval(interval);
  }, [activeTask, startTime, showAlert]);

  const handleContinue = useCallback(async () => {
    // "I'm in the flow" - push schedule forward, reset alert
    setShowAlert(false);
    // Dispatch event to notify Gantt/schedule to push remaining tasks
    window.dispatchEvent(new CustomEvent('calmplan:schedule-push', {
      detail: { taskId: activeTask?.id, extraMinutes: 30 }
    }));
  }, [activeTask]);

  const handleStop = useCallback(async () => {
    // "Stopping here" - mark as partial, move to next
    if (activeTask) {
      try {
        await Task.update(activeTask.id, {
          status: 'in_progress',
          notes: (activeTask.notes || '') + '\n[Reality Check: הופסק באמצע - ' + new Date().toLocaleDateString('he-IL') + ']'
        });
      } catch { /* ignore */ }
    }
    setShowAlert(false);
    setActiveTask(null);
    setStartTime(null);
  }, [activeTask]);

  return (
    <AnimatePresence>
      {showAlert && activeTask && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-white border-2 border-blue-300 rounded-2xl shadow-2xl p-4 w-[400px] max-w-[calc(100vw-2rem)]"
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-xl shrink-0">
              <Hourglass className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-blue-800 text-sm">Reality Check</h3>
              <p className="text-xs text-gray-600 mt-1">
                את עובדת על <strong>"{activeTask.title}"</strong> כבר {elapsedMinutes} דקות.
                הזמן המוערך חלף.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1"
                  onClick={handleContinue}
                >
                  <Play className="w-3 h-3" />
                  אני בשוונג
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={handleStop}
                >
                  <Square className="w-3 h-3" />
                  עוצרת כאן
                </Button>
              </div>
            </div>
            <button onClick={() => setShowAlert(false)} className="text-gray-400 hover:text-gray-600">
              <span className="text-lg">&times;</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
