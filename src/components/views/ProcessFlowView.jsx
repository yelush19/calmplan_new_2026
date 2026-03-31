/**
 * ── ProcessFlowView: Linear Flow Visualization ──
 * Shows process steps as a horizontal/vertical flow with "you are here" indicator.
 * For accounting workflows: shows which steps are done, which is current, which pending.
 *
 * Used in: Tasks page (as a view option), Dashboard pages, Client card
 */
import React, { useMemo } from 'react';
import { CheckCircle, Circle, Lock, ArrowLeft } from 'lucide-react';

const STATUS_COLORS = {
  completed: { bg: '#DCFCE7', border: '#16A34A', text: '#15803D', icon: CheckCircle },
  current: { bg: '#DBEAFE', border: '#2563EB', text: '#1D4ED8', icon: Circle },
  pending: { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280', icon: Circle },
  locked: { bg: '#FEF3C7', border: '#D97706', text: '#92400E', icon: Lock },
};

export default function ProcessFlowView({ tasks = [], clients = [], onEditTask, onStatusChange }) {
  // Group tasks by client, then show flow per client
  const clientFlows = useMemo(() => {
    const byClient = {};
    tasks.forEach(t => {
      const key = t.client_name || 'ללא לקוח';
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(t);
    });

    return Object.entries(byClient).map(([clientName, clientTasks]) => {
      // Sort by SLA day / due_date
      const sorted = [...clientTasks].sort((a, b) => {
        const slaA = a.sla_day || 99;
        const slaB = b.sla_day || 99;
        if (slaA !== slaB) return slaA - slaB;
        return (a.due_date || '').localeCompare(b.due_date || '');
      });

      const steps = sorted.map(task => {
        const isDone = task.status === 'production_completed' || task.status === 'completed';
        const isLocked = task.status === 'waiting_for_materials';
        const isCurrent = !isDone && !isLocked && task.status !== 'not_started';

        return {
          task,
          status: isDone ? 'completed' : isCurrent ? 'current' : isLocked ? 'locked' : 'pending',
          label: task.category || task.title?.split(' - ')[0] || task.title,
          dueDate: task.due_date,
        };
      });

      const completedCount = steps.filter(s => s.status === 'completed').length;
      const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

      return { clientName, steps, progress, completedCount, totalCount: steps.length };
    }).sort((a, b) => a.progress - b.progress); // Show least complete first
  }, [tasks]);

  if (clientFlows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-sm font-medium">אין משימות להצגת זרימה</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {clientFlows.map(({ clientName, steps, progress, completedCount, totalCount }) => (
        <div key={clientName} className="border rounded-xl bg-white overflow-hidden">
          {/* Client header with progress */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">{clientName}</span>
              <span className="text-xs text-slate-400">{completedCount}/{totalCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#16A34A' : progress > 50 ? '#2563EB' : '#D97706'
                }} />
              </div>
              <span className="text-xs font-bold" style={{
                color: progress === 100 ? '#16A34A' : progress > 50 ? '#2563EB' : '#D97706'
              }}>{progress}%</span>
            </div>
          </div>

          {/* Flow steps */}
          <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
            {steps.map((step, idx) => {
              const colors = STATUS_COLORS[step.status];
              const Icon = colors.icon;
              const isLast = idx === steps.length - 1;

              return (
                <React.Fragment key={step.task.id}>
                  <button
                    onClick={() => onEditTask?.(step.task)}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-md shrink-0 min-w-[80px]"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    title={`${step.label}\n${step.task.title}\nסטטוס: ${step.status}\nדד-ליין: ${step.dueDate || 'לא נקבע'}`}
                  >
                    <Icon className="w-5 h-5" style={{ color: colors.text }} />
                    <span className="text-[11px] font-bold text-center leading-tight" style={{ color: colors.text }}>
                      {step.label?.length > 12 ? step.label.slice(0, 12) + '...' : step.label}
                    </span>
                    {step.dueDate && (
                      <span className="text-[9px]" style={{ color: colors.text }}>
                        {new Date(step.dueDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                      </span>
                    )}
                  </button>
                  {!isLast && (
                    <ArrowLeft className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
