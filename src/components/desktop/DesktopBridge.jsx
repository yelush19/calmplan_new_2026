import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/api/entities';
import { createPageUrl } from '@/utils';

/**
 * DesktopBridge - Connects the React app with Electron's native features.
 *
 * Handles:
 * - Quick Capture: receives new tasks from the global command bar
 * - Reality Check: sends current task data to the floating widget
 * - System Tray: updates pressure level and next tasks
 * - File Drop: handles files dropped on the app
 * - Tray Actions: responds to tray menu clicks
 */
export default function DesktopBridge({ currentTask, tasks = [], onTaskCreated, onFileReceived }) {
  const navigate = useNavigate();
  const desktop = window.calmplanDesktop;
  const updateInterval = useRef(null);

  // ── Quick Capture Handler ──
  useEffect(() => {
    if (!desktop) return;

    const cleanup = desktop.quickCapture.onNewTask(async (taskText) => {
      try {
        // Create task in "inbox" / parking status
        const newTask = await Task.create({
          title: taskText,
          status: 'todo',
          priority: 'medium',
          source: 'quick-capture',
          created_date: new Date().toISOString().split('T')[0],
          notes: 'נוצר דרך לכידה מהירה (Quick Capture)',
        });

        // Show native notification
        desktop.notification.show(
          'משימה נוספה',
          taskText,
          'low'
        );

        if (onTaskCreated) onTaskCreated(newTask);
      } catch (error) {
        console.error('Failed to create quick capture task:', error);
        desktop.notification.show(
          'שגיאה',
          'לא הצלחתי לשמור את המשימה',
          'normal'
        );
      }
    });

    return cleanup;
  }, [desktop, onTaskCreated]);

  // ── Reality Check Updater ──
  useEffect(() => {
    if (!desktop || !currentTask) return;

    const updateRealityCheck = () => {
      const now = new Date();
      const taskSize = currentTask.size || 'M';

      // Calculate time allocation based on size
      const sizeMinutes = { S: 15, M: 30, L: 60 };
      const allocatedMinutes = sizeMinutes[taskSize] || 30;

      // Calculate elapsed time
      const startTime = currentTask.startTime
        ? new Date(currentTask.startTime)
        : now;
      const elapsedMs = now - startTime;
      const elapsedMinutes = elapsedMs / (1000 * 60);

      const progress = Math.min((elapsedMinutes / allocatedMinutes) * 100, 150);
      const timeExceeded = elapsedMinutes > allocatedMinutes;

      const remainingMinutes = Math.max(0, allocatedMinutes - elapsedMinutes);
      const mins = Math.floor(remainingMinutes);
      const secs = Math.floor((remainingMinutes - mins) * 60);
      const timeRemaining = timeExceeded
        ? `-${Math.floor(elapsedMinutes - allocatedMinutes)}:${String(Math.floor(((elapsedMinutes - allocatedMinutes) % 1) * 60)).padStart(2, '0')}`
        : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      desktop.realityCheck.update({
        taskName: currentTask.title || currentTask.name,
        size: taskSize,
        progress,
        timeRemaining,
        timeExceeded,
      });
    };

    updateRealityCheck();
    updateInterval.current = setInterval(updateRealityCheck, 1000);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [desktop, currentTask]);

  // ── Reality Check Response Handler ──
  useEffect(() => {
    if (!desktop) return;

    const cleanup = desktop.realityCheck.onResponse((response) => {
      if (response === 'next') {
        // User chose to move on - navigate to tasks
        navigate(createPageUrl('Tasks'));
      }
      // 'continue' - user is in flow, just dismiss the flash
    });

    return cleanup;
  }, [desktop, navigate]);

  // ── Pressure Level Calculator ──
  const calculatePressure = useCallback(() => {
    if (!tasks || tasks.length === 0) return 'green';

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'not_relevant') return false;
      return t.due_date && t.due_date < today;
    });

    const urgentToday = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'not_relevant') return false;
      return t.due_date === today && (t.priority === 'high' || t.priority === 'urgent');
    });

    if (overdueTasks.length > 3) return 'purple';  // פיגור
    if (urgentToday.length > 0 || overdueTasks.length > 0) return 'orange';  // דחוף
    return 'green';  // הכל תחת שליטה
  }, [tasks]);

  // ── Tray Updates ──
  useEffect(() => {
    if (!desktop) return;

    // Update pressure level
    const pressure = calculatePressure();
    desktop.tray.updatePressure(pressure);

    // Update next tasks
    const upcomingTasks = tasks
      .filter(t => t.status !== 'completed' && t.status !== 'not_relevant')
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      })
      .slice(0, 3)
      .map(t => ({
        title: t.title || t.name,
        size: t.size || 'M',
        priority: t.priority,
        due_date: t.due_date,
      }));

    desktop.tray.updateTasks(upcomingTasks);
  }, [desktop, tasks, calculatePressure]);

  // ── File Drop Handler ──
  useEffect(() => {
    if (!desktop) return;

    const cleanup = desktop.file.onReceived((files) => {
      if (onFileReceived) {
        onFileReceived(files);
      }
    });

    return cleanup;
  }, [desktop, onFileReceived]);

  // ── Tray Action Handler ──
  useEffect(() => {
    if (!desktop) return;

    const cleanup = desktop.onTrayAction((action) => {
      switch (action) {
        case 'focus-mode':
          desktop.window.setFocusMode(true);
          break;
        case 'open-clients':
          navigate(createPageUrl('ClientManagement'));
          break;
        case 'toggle-reality-check':
          desktop.realityCheck.toggle();
          break;
      }
    });

    return cleanup;
  }, [desktop, navigate]);

  // This is a bridge component - no UI
  return null;
}
