/**
 * ── BiologicalClock Context: Time-Based Focus Engine ──
 *
 * Manages the user's biological rhythm and dynamic task visibility:
 *
 * Morning   (07:00-08:15): Personal/Pets/Home Focus → P4
 * Work      (08:15-16:15): Professional Focus → P1, P2, P3
 * Afternoon (16:15-20:30): Family/Home/Rest → P4
 * Evening   (20:30-22:00): Administrative/Home Maintenance/Planning → P3, P4
 *
 * Dynamic Visibility Rules:
 * - Professional tasks hide during personal hours
 * - Home tasks hide during work hours
 * - High Priority tasks are ALWAYS visible regardless of zone
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const BiologicalClockContext = createContext(null);

// ── Time Zone Definitions ──
export const TIME_ZONES = {
  morning: {
    key: 'morning',
    label: 'בוקר אישי',
    labelEn: 'Morning Personal',
    icon: '🌅',
    start: '07:00',
    end: '08:15',
    startMinutes: 420,   // 7 * 60
    endMinutes: 495,     // 8 * 60 + 15
    activeBranches: ['P4'],
    color: '#FFC107',
    description: 'אישי / חיות מחמד / בית',
  },
  work: {
    key: 'work',
    label: 'עבודה מקצועית',
    labelEn: 'Professional Work',
    icon: '💼',
    start: '08:15',
    end: '16:15',
    startMinutes: 495,
    endMinutes: 975,     // 16 * 60 + 15
    activeBranches: ['P1', 'P2', 'P3'],
    color: '#1565C0',
    description: 'מיקוד מקצועי (P1-P3)',
  },
  afternoon: {
    key: 'afternoon',
    label: 'אחר הצהריים',
    labelEn: 'Family/Rest',
    icon: '🏡',
    start: '16:15',
    end: '20:30',
    startMinutes: 975,
    endMinutes: 1230,    // 20 * 60 + 30
    activeBranches: ['P4'],
    color: '#4CAF50',
    description: 'משפחה / בית / מנוחה',
  },
  evening: {
    key: 'evening',
    label: 'ערב — תחזוקה',
    labelEn: 'Evening Admin',
    icon: '🌙',
    start: '20:30',
    end: '22:00',
    startMinutes: 1230,
    endMinutes: 1320,    // 22 * 60
    activeBranches: ['P3', 'P4'],
    color: '#7B1FA2',
    description: 'אדמיניסטרציה / תחזוקת בית / תכנון',
  },
  offHours: {
    key: 'offHours',
    label: 'שעות מנוחה',
    labelEn: 'Off Hours',
    icon: '😴',
    start: '22:00',
    end: '07:00',
    startMinutes: 1320,
    endMinutes: 420,
    activeBranches: [],
    color: '#455A64',
    description: 'מנוחה — אין משימות פעילות',
  },
};

const TIME_ZONE_ORDER = ['morning', 'work', 'afternoon', 'evening', 'offHours'];

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function detectTimeZone(minuteOfDay) {
  if (minuteOfDay >= 420 && minuteOfDay < 495) return TIME_ZONES.morning;
  if (minuteOfDay >= 495 && minuteOfDay < 975) return TIME_ZONES.work;
  if (minuteOfDay >= 975 && minuteOfDay < 1230) return TIME_ZONES.afternoon;
  if (minuteOfDay >= 1230 && minuteOfDay < 1320) return TIME_ZONES.evening;
  return TIME_ZONES.offHours;
}

/**
 * Determine branch key (P1-P5) from task category
 */
function getTaskBranch(task) {
  const cat = task?.category || '';
  // P4 Home
  if (cat === 'home' || cat === 'בית' || cat.startsWith('home_')) return 'P4';
  // P5 Annual
  if (cat.includes('annual') || cat.includes('שנתי') || cat.includes('הצהרת')) return 'P5';
  // P1 Payroll
  if (['שכר', 'work_payroll', 'ביטוח לאומי', 'ביטוח לאומי — דיווח', 'work_social_security', 'ניכויים', 'ניכויים — דיווח', 'work_deductions',
       'מס"ב עובדים', 'work_masav', 'מס"ב סוציאליות', 'work_masav_social', 'פנסיות וקרנות', 'סוציאליות',
       'work_social_benefits', 'פנסיות — מתפעל', 'work_social_operator', 'פנסיות — טמל', 'work_social_taml',
       'משלוח תלושים', 'work_payslip_sending', 'מילואים', 'work_reserve_claims',
       'הנחיות מס"ב ממתפעל'].includes(cat)) return 'P1';
  // P2 Bookkeeping
  if (['מע"מ', 'work_vat_reporting', 'מע"מ 874', 'work_vat_874', 'מקדמות מס', 'work_tax_advances',
       'התאמות', 'work_reconciliation', 'הנהלת חשבונות', 'work_bookkeeping', 'רווח והפסד', 'work_pnl',
       'תשלום רשויות', 'work_authorities_payment', 'מס"ב רשויות', 'work_masav_authorities',
       'מס"ב ספקים', 'work_masav_suppliers', 'דיווח למתפעל', 'work_operator_reporting',
       'דיווח לטמל', 'work_taml_reporting'].includes(cat)) return 'P2';
  // P3 Office/Admin
  return 'P3';
}

/**
 * Check if a task should be visible given the current biological time zone
 */
function isTaskVisible(task, currentZone, overrideEnabled = true) {
  // Override disabled → show everything
  if (!overrideEnabled) return true;
  // Off hours → show nothing (unless high priority)
  if (currentZone.key === 'offHours') {
    return task.priority === 'urgent' || task.priority === 'high';
  }
  // High priority tasks are ALWAYS visible
  if (task.priority === 'urgent' || task.priority === 'high') return true;
  // Check if task's branch matches current zone's active branches
  const branch = getTaskBranch(task);
  return currentZone.activeBranches.includes(branch);
}

export function BiologicalClockProvider({ children }) {
  const [currentZone, setCurrentZone] = useState(() => detectTimeZone(getCurrentMinutes()));
  const [dynamicVisibility, setDynamicVisibility] = useState(true);
  const [manualOverride, setManualOverride] = useState(null); // force a specific zone

  // Update zone every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (!manualOverride) {
        setCurrentZone(detectTimeZone(getCurrentMinutes()));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [manualOverride]);

  const activeZone = manualOverride ? TIME_ZONES[manualOverride] : currentZone;

  const forceZone = useCallback((zoneKey) => {
    if (zoneKey && TIME_ZONES[zoneKey]) {
      setManualOverride(zoneKey);
      setCurrentZone(TIME_ZONES[zoneKey]);
    } else {
      setManualOverride(null);
      setCurrentZone(detectTimeZone(getCurrentMinutes()));
    }
  }, []);

  const toggleDynamicVisibility = useCallback(() => {
    setDynamicVisibility(prev => !prev);
  }, []);

  const filterTasksByBioClock = useCallback((taskList) => {
    if (!dynamicVisibility) return taskList;
    return taskList.filter(t => isTaskVisible(t, activeZone, dynamicVisibility));
  }, [activeZone, dynamicVisibility]);

  const getZoneProgress = useCallback(() => {
    const now = getCurrentMinutes();
    const zone = activeZone;
    if (zone.key === 'offHours') {
      // Off hours wraps around midnight
      const total = (1440 - zone.startMinutes) + zone.endMinutes;
      const elapsed = now >= zone.startMinutes ? (now - zone.startMinutes) : (1440 - zone.startMinutes + now);
      return Math.min(1, elapsed / total);
    }
    const total = zone.endMinutes - zone.startMinutes;
    const elapsed = now - zone.startMinutes;
    return Math.max(0, Math.min(1, elapsed / total));
  }, [activeZone]);

  const contextValue = useMemo(() => ({
    currentZone: activeZone,
    dynamicVisibility,
    toggleDynamicVisibility,
    forceZone,
    manualOverride,
    filterTasksByBioClock,
    isTaskVisible: (task) => isTaskVisible(task, activeZone, dynamicVisibility),
    getTaskBranch,
    getZoneProgress,
    TIME_ZONES,
    TIME_ZONE_ORDER,
  }), [activeZone, dynamicVisibility, toggleDynamicVisibility, forceZone, manualOverride, filterTasksByBioClock, getZoneProgress]);

  return (
    <BiologicalClockContext.Provider value={contextValue}>
      {children}
    </BiologicalClockContext.Provider>
  );
}

export function useBiologicalClock() {
  const ctx = useContext(BiologicalClockContext);
  if (!ctx) throw new Error('useBiologicalClock must be used within BiologicalClockProvider');
  return ctx;
}
