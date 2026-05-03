// ═══════════════════════════════════════════════════════════════
// MindMap page — Stage 5.11
// ═══════════════════════════════════════════════════════════════
//
// Replaces the old AyoaRadialView (which tried to render every active
// task as its own leaf and turned into a dense maze when there were
// >50 active tasks). The new mind map is the SAME service-domain
// AyoaMiniMap used on Home — circles per work domain (שכר / מע"מ /
// ביטוח לאומי / ...) with a status ring, urgency badges, and a
// click-to-open drawer that shows the full GroupedServiceTable for
// that domain. Same view, full page, no maxWidth cap.
//
// AyoaRadialView is still in the codebase (canvas/AyoaRadialView.jsx)
// for the future "design canvas" use-case but no longer mounted here.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import AyoaMiniMap from '@/components/home/AyoaMiniMap';
import TaskSidePanel from '@/components/tasks/TaskSidePanel';
import { Loader2 } from 'lucide-react';
import { getEffectiveStatus } from '@/utils/effectiveStatus';
import { getTaskProcessSteps, toggleStep, areAllStepsDone, markAllStepsDone } from '@/config/processTemplates';
import { evaluateAuthorityStatus } from '@/engines/taskCascadeEngine';

export default function MindMap() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [tList, cList] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 1000).catch(() => []),
      ]);
      const cMap = new Map();
      (cList || []).forEach(c => { if (c?.name) cMap.set(c.name, c); });
      // Active tasks (skip completed). awaiting_recording stays in so it
      // surfaces in the low-priority "רישום פקודות" circle, matching Home.
      const active = (tList || []).filter(t => {
        const s = getEffectiveStatus(t, cMap.get(t.client_name) || null);
        return s !== 'production_completed';
      });
      setTasks(active);
      setClients(cList || []);
    } catch (err) {
      setError(err?.message || 'שגיאה בטעינת המפה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadAll();
    })();
    return () => { alive = false; };
  }, [loadAll]);

  // Live-refresh on standard task events.
  useEffect(() => {
    const refresh = () => loadAll();
    window.addEventListener('calmplan:task-completed', refresh);
    window.addEventListener('calmplan:tasks-changed', refresh);
    window.addEventListener('calmplan:data-synced', refresh);
    return () => {
      window.removeEventListener('calmplan:task-completed', refresh);
      window.removeEventListener('calmplan:tasks-changed', refresh);
      window.removeEventListener('calmplan:data-synced', refresh);
    };
  }, [loadAll]);

  // Inline-edit handlers — let the drawer feel as live as it does on Home.
  const handleStatusChange = async (task, newStatus) => {
    try {
      await Task.update(task.id, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('שגיאה בעדכון סטטוס:', err);
    }
  };

  const handleToggleStep = async (task, stepKey) => {
    try {
      const currentSteps = getTaskProcessSteps(task);
      const updatedSteps = toggleStep(currentSteps, stepKey);
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };
      const authority = evaluateAuthorityStatus(updatedTask, updatedSteps);
      if (authority?.status && authority.status !== task.status) {
        updatePayload.status = authority.status;
      } else if (allDone && task.status !== 'production_completed') {
        updatePayload.status = 'production_completed';
      }
      if (updatePayload.status === 'production_completed') {
        updatePayload.process_steps = markAllStepsDone({ ...task, process_steps: updatePayload.process_steps });
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
    } catch (err) {
      console.error('שגיאה בעדכון שלב:', err);
    }
  };

  const handleEditTaskSave = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      await loadAll();
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
    }
  };

  return (
    <div className="w-full min-h-screen px-4 py-3" dir="rtl">
      <div className="mb-3 flex items-baseline gap-3">
        <h1 className="text-xl font-bold text-gray-900">מפת חשיבה</h1>
        <span className="text-sm text-gray-500">
          {loading
            ? 'טוען משימות…'
            : `${tasks.length} משימות פעילות · לחצי על עיגול לפתיחת מגירה עם הטבלה המלאה`}
        </span>
      </div>

      <div className="w-full bg-white rounded-2xl border border-gray-200 p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>טוען את המפה…</span>
          </div>
        ) : error ? (
          <div className="h-64 flex items-center justify-center text-red-500 text-sm">
            {error}
          </div>
        ) : (
          <AyoaMiniMap
            tasks={tasks}
            clients={clients}
            title="מפת חשיבה — תחומי שירות פעילים"
            maxWidth={null}
            onStatusChange={handleStatusChange}
            onToggleStep={handleToggleStep}
            onEditTask={setEditingTask}
            onNote={() => {/* notes don't make sense from this page */}}
          />
        )}
      </div>

      <TaskSidePanel
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTaskSave}
      />
    </div>
  );
}
