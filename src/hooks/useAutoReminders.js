import { useEffect, useRef } from 'react';
import { Task, StickyNote } from '@/api/entities';
import { differenceInDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

const DONE_STATUSES = ['completed', 'not_relevant', 'cancelled'];

/**
 * Remove sticky notes linked to tasks that are now completed/cancelled/not_relevant.
 * Can be called from anywhere after a task status change.
 */
export async function syncNotesWithTaskStatus(taskId, newStatus) {
  if (!taskId || !DONE_STATUSES.includes(newStatus)) return;
  try {
    const allNotes = await StickyNote.list(null, 5000).catch(() => []);
    const linkedNotes = (allNotes || []).filter(n => n.linked_task_id === taskId);
    for (const note of linkedNotes) {
      await StickyNote.delete(note.id);
    }
  } catch (err) {
    console.error('Error syncing note with task status:', err);
  }
}

/**
 * Auto-reminder hook:
 * 1. Cleans up sticky notes linked to completed/cancelled tasks
 * 2. Creates sticky notes for non-completed tasks due within 3 days
 * Runs once on mount (per session).
 */
export default function useAutoReminders() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const checkAndCreateReminders = async () => {
      try {
        const allTasks = await Task.list(null, 5000).catch(() => []);
        const allTasksArr = allTasks || [];
        const taskMap = new Map(allTasksArr.map(t => [t.id, t]));

        // Load existing sticky notes
        const existingNotes = await StickyNote.list(null, 5000).catch(() => []);
        const notesArr = existingNotes || [];

        // --- Step 1: Clean up notes linked to completed/cancelled/not_relevant tasks ---
        let removed = 0;
        for (const note of notesArr) {
          if (!note.linked_task_id) continue;
          const linkedTask = taskMap.get(note.linked_task_id);
          // Remove if task is done or was deleted
          if (!linkedTask || DONE_STATUSES.includes(linkedTask.status)) {
            await StickyNote.delete(note.id);
            removed++;
          }
        }

        // --- Step 2: Create reminders for upcoming tasks ---
        const activeTasks = allTasksArr.filter(t =>
          !DONE_STATUSES.includes(t.status) && t.due_date
        );

        if (activeTasks.length === 0) {
          if (removed > 0) {
            toast.info(`נוקו ${removed} פתקים של משימות שהושלמו`, { duration: 4000 });
          }
          return;
        }

        // Rebuild linked set after cleanup
        const stillLinked = new Set(
          notesArr
            .filter(n => n.linked_task_id && taskMap.get(n.linked_task_id) && !DONE_STATUSES.includes(taskMap.get(n.linked_task_id).status))
            .map(n => n.linked_task_id)
        );

        const today = startOfDay(new Date());
        let created = 0;

        for (const task of activeTasks) {
          if (stillLinked.has(task.id)) continue;

          const dueDate = startOfDay(new Date(task.due_date));
          const daysUntilDue = differenceInDays(dueDate, today);

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

        const msgs = [];
        if (removed > 0) msgs.push(`נוקו ${removed} פתקים של משימות שהושלמו`);
        if (created > 0) msgs.push(`נוצרו ${created} תזכורות למשימות קרובות`);
        if (msgs.length > 0) {
          toast.info(msgs.join(' | '), { duration: 5000 });
        }
      } catch (error) {
        console.error('Auto-reminders error:', error);
      }
    };

    const timer = setTimeout(checkAndCreateReminders, 2000);
    return () => clearTimeout(timer);
  }, []);
}
