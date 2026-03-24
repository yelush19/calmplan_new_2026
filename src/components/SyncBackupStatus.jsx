import React, { useState, useEffect } from 'react';
import SyncStatusIndicator from './SyncStatusIndicator';
import BackupHealthIndicator from './BackupHealthIndicator';
import { syncStatus } from '@/api/base44Client';

/**
 * SyncBackupStatus - Wrapper that combines sync & backup indicators
 * with a compact visible text line showing key timing info.
 *
 * Displays:  ☁ סנכרון: HH:MM  |  💾 גיבוי: HH:MM  |  ⏭ הבא: XXדק׳
 */
export default function SyncBackupStatus({ health }) {
  const [now, setNow] = useState(Date.now());

  // Update every 30 seconds so the countdown stays fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isCloud = syncStatus.isCloud;

  // --- derive display strings ---

  // Last sync: we listen for the custom event dispatched by SyncStatusIndicator
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    const handler = () => setLastSyncTime(new Date());
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  const syncText = isCloud
    ? lastSyncTime
      ? `סנכרון: ${lastSyncTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
      : 'סנכרון: —'
    : 'מקומי';

  // Backup time
  const backupTimeText = (() => {
    if (!health || !health.lastBackup) return null;
    const d = new Date(health.lastBackup);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return `גיבוי: ${isToday ? time : d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + time}`;
  })();

  // Next backup countdown
  const nextText = (() => {
    if (!health || health.nextBackupMinutes == null) return null;
    const mins = health.nextBackupMinutes;
    if (mins === 0) return 'הבא: עכשיו';
    if (mins < 60) return `הבא: ${mins} דק׳`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `הבא: ${h}:${String(m).padStart(2, '0')}`;
  })();

  return (
    <div className="flex items-center gap-1.5">
      {/* Icon indicators (existing components) */}
      <SyncStatusIndicator />
      <BackupHealthIndicator health={health} />

      {/* Compact visible text line */}
      <div
        className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-500 font-mono leading-none mr-1 select-none"
        dir="rtl"
      >
        <span>{syncText}</span>
        {backupTimeText && (
          <>
            <span className="text-slate-300">|</span>
            <span>{backupTimeText}</span>
          </>
        )}
        {nextText && (
          <>
            <span className="text-slate-300">|</span>
            <span>{nextText}</span>
          </>
        )}
      </div>
    </div>
  );
}
