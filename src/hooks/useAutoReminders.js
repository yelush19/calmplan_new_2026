import { useEffect, useRef } from 'react';
import { Task, StickyNote } from '@/api/entities';
import { differenceInDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

/**
 * Auto-reminder hook:
 * Checks all non-completed tasks with a due_date within 3 days
 * and creates sticky notes for ones that don't already have one.
 * Runs once on mount (per session).
 */
export default function useAutoReminders() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const checkAndCreateReminders = async () => {
      try {
        // Load all non-completed tasks
        const allTasks = await Task.list(null, 5000).catch(() => []);
        const tasks = (allTasks || []).filter(t =>
          t.status !== 'completed' &&
          t.status !== 'not_relevant' &&
          t.status !== 'cancelled' &&
          t.due_date
        );

        if (tasks.length === 0) return;

        // Load existing sticky notes to check for duplicates
        const existingNotes = await StickyNote.list(null, 5000).catch(() => []);
        const linkedTaskIds = new Set(
          (existingNotes || [])
            .filter(n => n.linked_task_id)
            .map(n => n.linked_task_id)
        );

        const today = startOfDay(new Date());
        let created = 0;

        for (const task of tasks) {
          // Skip if already has a sticky note
          if (linkedTaskIds.has(task.id)) continue;

          const dueDate = startOfDay(new Date(task.due_date));
          const daysUntilDue = differenceInDays(dueDate, today);

          // Create reminder for tasks due within 3 days (including overdue)
          if (daysUntilDue <= 3) {
            const urgency = daysUntilDue <= 0 ? 'urgent' : daysUntilDue <= 1 ? 'high' : 'medium';
            const colorMap = { urgent: 'pink', high: 'pink', medium: 'yellow' };
            const prefix = daysUntilDue < 0
              ? `⚠️ באיחור ${Math.abs(daysUntilDue)} ימים!`
              : daysUntilDue === 0
                ? '🔴 היום!'
                : `⏰ עוד ${daysUntilDue} ימים`;

            const contentParts = [prefix];
            if (task.client_name) contentParts.push(`לקוח: ${task.client_name}`);
            if (task.category) contentParts.push(`קטגוריה: ${task.category}`);
            if (task.description) contentParts.push(task.description);

            await StickyNote.create({
              title: `📌 ${task.title}`,
              content: contentParts.join('\n'),
              color: colorMap[urgency] || 'yellow',
              pinned: true,
              linked_task_id: task.id,
              linked_task_title: task.title,
              client_name: task.client_name || null,
              urgency,
              due_date: task.due_date,
              category: 'client_work',
              order: Date.now(),
            });
            created++;
          }
        }

        if (created > 0) {
          toast.info(`נוצרו ${created} תזכורות אוטומטיות למשימות קרובות`, {
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Auto-reminders error:', error);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(checkAndCreateReminders, 2000);
    return () => clearTimeout(timer);
  }, []);
}
