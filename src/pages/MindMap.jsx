// ═══════════════════════════════════════════════════════════════
// MindMap page — Stage 5.3 (rewritten)
// ═══════════════════════════════════════════════════════════════
//
// Mounts the real AYOA radial canvas (src/components/canvas/AyoaRadialView.jsx)
// — the mature, tapered-branch, DesignContext-aware view — and feeds it live
// Task data so branches reflect the actual work in the system.
//
// The previous draft (src/components/views/RadialMindMapView.jsx, stage 5.3a)
// was a hand-rolled SVG that used only the static PROCESS_TREE_SEED with rigid
// circles and straight lines — it looked nothing like AYOA and was disconnected
// from real work. That component is now removed; this page replaces it.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Task } from '@/api/entities';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import { Loader2 } from 'lucide-react';

export default function MindMap() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await Task.list(null, 5000);
        if (!alive) return;
        // Skip completed work so the map shows what's still in flight.
        const active = (list || []).filter(t =>
          t.status !== 'production_completed' && t.status !== 'completed'
        );
        setTasks(active);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'שגיאה בטעינת המשימות');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Re-load whenever anything in the app emits the standard task-changed event
  useEffect(() => {
    const refresh = async () => {
      try {
        const list = await Task.list(null, 5000);
        const active = (list || []).filter(t =>
          t.status !== 'production_completed' && t.status !== 'completed'
        );
        setTasks(active);
      } catch { /* ignore transient failures */ }
    };
    window.addEventListener('calmplan:task-completed', refresh);
    window.addEventListener('calmplan:tasks-changed', refresh);
    return () => {
      window.removeEventListener('calmplan:task-completed', refresh);
      window.removeEventListener('calmplan:tasks-changed', refresh);
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-120px)] min-h-[600px] px-4 py-3" dir="rtl">
      <div className="mb-3 flex items-baseline gap-3">
        <h1 className="text-xl font-bold text-gray-900">מפת חשיבה</h1>
        <span className="text-sm text-gray-500">
          {loading
            ? 'טוען משימות…'
            : `${tasks.length} משימות פעילות · גררי לזוז · גלגל לזום · לחצי על ענף לפתיחה`}
        </span>
      </div>

      <div className="w-full h-[calc(100%-40px)] bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>טוען את המפה…</span>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-500 text-sm">
            {error}
          </div>
        ) : (
          <AyoaRadialView
            tasks={tasks}
            centerLabel="CalmPlan"
            centerSub={`${tasks.length} משימות פעילות`}
          />
        )}
      </div>
    </div>
  );
}
