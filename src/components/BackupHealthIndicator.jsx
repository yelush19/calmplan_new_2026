import React, { useState } from 'react';
import { Cloud, CloudOff, AlertTriangle, Loader2, CheckCircle2, X } from 'lucide-react';

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    bgClass: 'bg-green-500',
    pulseClass: '',
    tooltipBg: 'bg-green-50 border-green-200 text-green-800',
  },
  checking: {
    icon: Loader2,
    bgClass: 'bg-blue-500',
    pulseClass: 'animate-spin',
    tooltipBg: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  backing_up: {
    icon: Loader2,
    bgClass: 'bg-blue-500 animate-pulse',
    pulseClass: 'animate-spin',
    tooltipBg: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500 animate-pulse',
    pulseClass: '',
    tooltipBg: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  overdue: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500 animate-pulse',
    pulseClass: '',
    tooltipBg: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  error: {
    icon: CloudOff,
    bgClass: 'bg-amber-500 animate-pulse',
    pulseClass: '',
    tooltipBg: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  disabled: {
    icon: CloudOff,
    bgClass: 'bg-gray-400',
    pulseClass: '',
    tooltipBg: 'bg-gray-50 border-gray-200 text-gray-600',
  },
};

export default function BackupHealthIndicator({ health }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!health || health.status === 'disabled') return null;

  const config = STATUS_CONFIG[health.status] || STATUS_CONFIG.disabled;
  const Icon = config.icon;

  const lastBackupDisplay = health.lastBackup
    ? new Date(health.lastBackup).toLocaleString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : 'לא ידוע';

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${config.bgClass} text-white shadow-sm hover:shadow-md`}
        title="מצב גיבוי"
      >
        <Icon className={`w-4 h-4 ${config.pulseClass}`} />
      </button>

      {showTooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
          <div className={`absolute top-10 left-0 z-50 w-56 p-3 rounded-lg border shadow-lg ${config.tooltipBg}`} style={{ direction: 'rtl' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4" />
                <span className="font-bold text-xs">מצב גיבוי</span>
              </div>
              <button onClick={() => setShowTooltip(false)} className="p-0.5 rounded hover:bg-black/10">
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs font-medium">{health.message}</p>
            {health.lastBackup && (
              <p className="text-[10px] mt-1 opacity-75">גיבוי אחרון: {lastBackupDisplay}</p>
            )}
            <p className="text-[10px] mt-1 opacity-60">בדיקה כל 30 דקות, גיבוי כל שעה</p>
          </div>
        </>
      )}
    </div>
  );
}
