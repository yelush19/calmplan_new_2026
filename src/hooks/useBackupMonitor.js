import { useState, useEffect, useRef, useCallback } from 'react';
import { isSupabaseConfigured } from '@/api/supabaseClient';

const BACKUP_CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 min
const WORK_HOURS_START = 7;  // 07:00
const WORK_HOURS_END = 22;   // 22:00
const BACKUP_OVERDUE_HOURS = 2; // Alert if no backup for 2+ hours during work hours

// localStorage keys
const LS_LAST_SUPA_BACKUP = 'calmplan_last_supa_backup';
const LS_LAST_SUPA_BACKUP_TIME = 'calmplan_last_supa_backup_time'; // full ISO timestamp
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

export default function useBackupMonitor() {
  const [backupHealth, setBackupHealth] = useState(() => {
    if (!isSupabaseConfigured) return { status: 'disabled', message: 'Supabase לא מוגדר' };
    const enabled = localStorage.getItem(LS_AUTO_BACKUP) === 'true';
    if (!enabled) return { status: 'disabled', message: 'גיבוי אוטומטי כבוי' };
    return { status: 'checking', message: 'בודק...' };
  });

  const hasInitialized = useRef(false);
  const intervalRef = useRef(null);

  const runSupabaseBackup = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      const { saveDailyBackupToSupabase } = await import('@/api/supabaseDB');
      const result = await saveDailyBackupToSupabase();
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      localStorage.setItem(LS_LAST_SUPA_BACKUP, today);
      localStorage.setItem(LS_LAST_SUPA_BACKUP_TIME, now.toISOString());
      // Clear errors on success
      localStorage.removeItem(LS_BACKUP_ERRORS);

      return { success: true, result };
    } catch (e) {
      console.error('Backup monitor - Supabase backup failed:', e);
      // Track errors
      const errors = JSON.parse(localStorage.getItem(LS_BACKUP_ERRORS) || '[]');
      errors.push({ time: new Date().toISOString(), error: e.message });
      // Keep last 10 errors
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
    const enabled = localStorage.getItem(LS_AUTO_BACKUP) === 'true';
    if (!enabled || !isSupabaseConfigured) {
      setBackupHealth({
        status: enabled ? 'disabled' : 'disabled',
        message: !isSupabaseConfigured ? 'Supabase לא מוגדר' : 'גיבוי אוטומטי כבוי'
      });
      return;
    }

    const lastBackupTime = localStorage.getItem(LS_LAST_SUPA_BACKUP_TIME);
    const hoursSince = getHoursSince(lastBackupTime);
    const errors = JSON.parse(localStorage.getItem(LS_BACKUP_ERRORS) || '[]');
    const recentErrors = errors.filter(e => getHoursSince(e.time) < 1);

    // Determine if backup is needed
    const needsBackup = hoursSince >= 1; // Backup every hour

    if (needsBackup) {
      setBackupHealth({ status: 'backing_up', message: 'מגבה עכשיו...' });

      // Run both local and Supabase backup
      const [localResult, supaResult] = await Promise.all([
        runLocalBackup(),
        runSupabaseBackup()
      ]);

      if (supaResult.success) {
        setBackupHealth({
          status: 'ok',
          message: `גיבוי תקין`,
          lastBackup: new Date().toISOString()
        });
      } else {
        setBackupHealth({
          status: 'error',
          message: `שגיאת גיבוי: ${supaResult.error}`,
          lastBackup: lastBackupTime
        });
      }
    } else {
      // Check health based on current state
      if (recentErrors.length > 0) {
        setBackupHealth({
          status: 'warning',
          message: `${recentErrors.length} שגיאות בשעה האחרונה`,
          lastBackup: lastBackupTime
        });
      } else if (hoursSince > BACKUP_OVERDUE_HOURS && isWorkHours()) {
        setBackupHealth({
          status: 'overdue',
          message: `גיבוי אחרון לפני ${Math.round(hoursSince)} שעות`,
          lastBackup: lastBackupTime
        });
      } else {
        setBackupHealth({
          status: 'ok',
          message: 'גיבוי תקין',
          lastBackup: lastBackupTime
        });
      }
    }
  }, [runSupabaseBackup, runLocalBackup]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Run initial check after a short delay to let app load
    const initTimeout = setTimeout(() => {
      checkAndBackup();
    }, 5000);

    // Set up periodic check
    intervalRef.current = setInterval(() => {
      checkAndBackup();
    }, BACKUP_CHECK_INTERVAL);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAndBackup]);

  return backupHealth;
}
