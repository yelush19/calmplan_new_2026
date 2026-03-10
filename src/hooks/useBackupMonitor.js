import { useState, useEffect, useRef, useCallback } from 'react';
import { isSupabaseConfigured } from '@/api/supabaseClient';

const BACKUP_INTERVAL_MS = 60 * 60 * 1000;   // Backup every 60 minutes
const CHECK_INTERVAL_MS = 10 * 60 * 1000;    // Check every 10 minutes (was 30)
const WORK_HOURS_START = 7;   // 07:00
const WORK_HOURS_END = 22;    // 22:00
const BACKUP_OVERDUE_HOURS = 2;

// localStorage keys
const LS_LAST_SUPA_BACKUP = 'calmplan_last_supa_backup';
const LS_LAST_SUPA_BACKUP_TIME = 'calmplan_last_supa_backup_time';
const LS_AUTO_BACKUP = 'calmplan_auto_backup';
const LS_AUTO_BACKUP_DATA = 'calmplan_auto_backup_data';
const LS_LAST_AUTO_BACKUP = 'calmplan_last_auto_backup';
const LS_BACKUP_ERRORS = 'calmplan_backup_errors';

function isWorkHours() {
  const hour = new Date().getHours();
  return hour >= WORK_HOURS_START && hour < WORK_HOURS_END;
}

function getHoursSince(isoString) {
  if (!isoString) return Infinity;
  const diff = Date.now() - new Date(isoString).getTime();
  return diff / (1000 * 60 * 60);
}

function getMinutesUntilNext(lastBackupTime) {
  if (!lastBackupTime) return 0;
  const nextBackup = new Date(lastBackupTime).getTime() + BACKUP_INTERVAL_MS;
  const remaining = nextBackup - Date.now();
  return Math.max(0, Math.round(remaining / (1000 * 60)));
}

export default function useBackupMonitor() {
  const [backupHealth, setBackupHealth] = useState(() => {
    if (!isSupabaseConfigured) {
      // Even without Supabase, enable local-only backup
      return { status: 'local_only', message: 'גיבוי מקומי פעיל', isActive: true };
    }
    const enabled = localStorage.getItem(LS_AUTO_BACKUP) === 'true';
    if (!enabled) return { status: 'disabled', message: 'גיבוי אוטומטי כבוי', isActive: false };
    return { status: 'checking', message: 'בודק...', isActive: true };
  });

  const hasInitialized = useRef(false);
  const intervalRef = useRef(null);

  const runSupabaseBackup = useCallback(async () => {
    if (!isSupabaseConfigured) return { success: false, error: 'not_configured' };

    try {
      const { saveDailyBackupToSupabase } = await import('@/api/supabaseDB');
      const result = await saveDailyBackupToSupabase();
      const now = new Date();

      localStorage.setItem(LS_LAST_SUPA_BACKUP, now.toISOString().split('T')[0]);
      localStorage.setItem(LS_LAST_SUPA_BACKUP_TIME, now.toISOString());
      localStorage.removeItem(LS_BACKUP_ERRORS);

      return { success: true, result };
    } catch (e) {
      console.error('Backup monitor - Supabase backup failed:', e);
      const errors = JSON.parse(localStorage.getItem(LS_BACKUP_ERRORS) || '[]');
      errors.push({ time: new Date().toISOString(), error: e.message });
      localStorage.setItem(LS_BACKUP_ERRORS, JSON.stringify(errors.slice(-10)));
      return { success: false, error: e.message };
    }
  }, []);

  const runLocalBackup = useCallback(async () => {
    try {
      const { exportAllData } = await import('@/api/supabaseDB');
      const data = await exportAllData();
      const snapshot = JSON.stringify(data);
      localStorage.setItem(LS_AUTO_BACKUP_DATA, snapshot);
      const now = new Date().toISOString();
      localStorage.setItem(LS_LAST_AUTO_BACKUP, now);
      return { success: true };
    } catch (e) {
      console.error('Backup monitor - local backup failed:', e);
      return { success: false, error: e.message };
    }
  }, []);

  const checkAndBackup = useCallback(async () => {
    // Always run local backup even without Supabase
    const supaEnabled = isSupabaseConfigured && localStorage.getItem(LS_AUTO_BACKUP) === 'true';

    const lastBackupTime = supaEnabled
      ? localStorage.getItem(LS_LAST_SUPA_BACKUP_TIME)
      : localStorage.getItem(LS_LAST_AUTO_BACKUP);
    const hoursSince = getHoursSince(lastBackupTime);
    const needsBackup = hoursSince >= 1;

    if (needsBackup) {
      setBackupHealth({
        status: 'backing_up',
        message: 'מגבה עכשיו...',
        isActive: true,
      });

      const localResult = await runLocalBackup();
      let supaResult = { success: false };
      if (supaEnabled) {
        supaResult = await runSupabaseBackup();
      }

      const nowIso = new Date().toISOString();
      const minutesUntilNext = 60;

      if (supaEnabled && supaResult.success) {
        setBackupHealth({
          status: 'ok',
          message: 'גיבוי תקין',
          lastBackup: nowIso,
          nextBackupMinutes: minutesUntilNext,
          isActive: true,
        });
      } else if (!supaEnabled && localResult.success) {
        setBackupHealth({
          status: 'local_only',
          message: 'גיבוי מקומי תקין',
          lastBackup: nowIso,
          nextBackupMinutes: minutesUntilNext,
          isActive: true,
        });
      } else {
        setBackupHealth({
          status: 'error',
          message: `שגיאת גיבוי`,
          lastBackup: lastBackupTime,
          isActive: true,
        });
      }
    } else {
      const errors = JSON.parse(localStorage.getItem(LS_BACKUP_ERRORS) || '[]');
      const recentErrors = errors.filter(e => getHoursSince(e.time) < 1);
      const minutesUntilNext = getMinutesUntilNext(lastBackupTime);

      if (recentErrors.length > 0) {
        setBackupHealth({
          status: 'warning',
          message: `${recentErrors.length} שגיאות בשעה האחרונה`,
          lastBackup: lastBackupTime,
          nextBackupMinutes: minutesUntilNext,
          isActive: true,
        });
      } else if (hoursSince > BACKUP_OVERDUE_HOURS && isWorkHours()) {
        setBackupHealth({
          status: 'overdue',
          message: `גיבוי אחרון לפני ${Math.round(hoursSince)} שעות`,
          lastBackup: lastBackupTime,
          nextBackupMinutes: minutesUntilNext,
          isActive: true,
        });
      } else {
        setBackupHealth({
          status: supaEnabled ? 'ok' : 'local_only',
          message: supaEnabled ? 'גיבוי תקין' : 'גיבוי מקומי פעיל',
          lastBackup: lastBackupTime,
          nextBackupMinutes: minutesUntilNext,
          isActive: true,
        });
      }
    }
  }, [runSupabaseBackup, runLocalBackup]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Run initial check after app loads
    const initTimeout = setTimeout(() => {
      checkAndBackup();
    }, 5000);

    // Check every 10 minutes (more frequent than before)
    intervalRef.current = setInterval(() => {
      checkAndBackup();
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAndBackup]);

  return backupHealth;
}
