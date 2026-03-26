import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext();

const ENERGY_LOAD_LIMITS = {
  low: 1,
  medium: 2,
  full: 3,
};

// Global display fields — which client fields show on task lists/dashboards
// Stored in localStorage, accessible from any component via useApp()
const DISPLAY_FIELDS_KEY = 'calmplan_global_display_fields';
const DEFAULT_DISPLAY_FIELDS = {
  entity_number: true,       // ח"פ / ע.מ.
  deductions_file: true,     // תיק ניכויים
  deductions_id: true,       // מזהה ניכויים
  advances_id: true,         // מזהה מקדמות
  social_security_id: false, // תיק ביטוח לאומי
  vat_file: false,           // תיק מע"מ
  shareholder_name: false,   // שם בעל מניות
  shareholder_id: false,     // ת"ז בעל מניות
  shareholder_phone: false,  // טלפון בעל מניות
};

export function AppProvider({ children }) {
  const [workMode, setWorkMode] = useState('doing');
  const [energyLevel, setEnergyLevel] = useState('full');
  const [focusMode, setFocusMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  // Global display fields
  const [displayFields, setDisplayFields] = useState(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_FIELDS_KEY);
      return saved ? { ...DEFAULT_DISPLAY_FIELDS, ...JSON.parse(saved) } : { ...DEFAULT_DISPLAY_FIELDS };
    } catch { return { ...DEFAULT_DISPLAY_FIELDS }; }
  });

  useEffect(() => {
    try { localStorage.setItem(DISPLAY_FIELDS_KEY, JSON.stringify(displayFields)); } catch {}
  }, [displayFields]);

  const updateDisplayField = useCallback((key, value) => {
    setDisplayFields(prev => ({ ...prev, [key]: value }));
  }, []);

  // Extract visible client fields for display — used globally
  const getClientDisplayIds = useCallback((client) => {
    if (!client) return [];
    const ids = [];
    const ti = client.tax_info || {};
    const annual = ti.annual_tax_ids || {};
    const sh = (client.shareholders || [])[0]; // First shareholder

    if (displayFields.entity_number && client.entity_number) ids.push({ l: 'ח"פ', v: client.entity_number });
    if (displayFields.deductions_file && ti.tax_deduction_file_number) ids.push({ l: 'תיק ניכויים', v: ti.tax_deduction_file_number });
    if (displayFields.deductions_id && annual.deductions_id) ids.push({ l: 'מזהה ניכויים', v: annual.deductions_id });
    if (displayFields.advances_id && annual.tax_advances_id) ids.push({ l: 'מקדמות', v: annual.tax_advances_id });
    if (displayFields.social_security_id && ti.social_security_file_number) ids.push({ l: 'ב"ל', v: ti.social_security_file_number });
    if (displayFields.vat_file && ti.vat_file_number) ids.push({ l: 'מע"מ', v: ti.vat_file_number });
    if (displayFields.shareholder_name && sh?.name) ids.push({ l: 'בעלים', v: sh.name });
    if (displayFields.shareholder_id && sh?.id_number) ids.push({ l: 'ת"ז בעלים', v: sh.id_number });
    if (displayFields.shareholder_phone && sh?.phone) ids.push({ l: 'טל בעלים', v: sh.phone });

    return ids;
  }, [displayFields]);

  const filterByEnergy = useCallback((tasks) => {
    if (!tasks || energyLevel === 'full') return tasks;
    const maxLoad = ENERGY_LOAD_LIMITS[energyLevel] ?? 3;
    return tasks.filter(t => {
      const load = t.cognitive_load ?? t.complexity_tier ?? 1;
      return load <= maxLoad;
    });
  }, [energyLevel]);

  return (
    <AppContext.Provider value={{
      workMode, setWorkMode,
      energyLevel, setEnergyLevel,
      focusMode, setFocusMode,
      activeFilter, setActiveFilter,
      filterByEnergy,
      displayFields, updateDisplayField, getClientDisplayIds,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
