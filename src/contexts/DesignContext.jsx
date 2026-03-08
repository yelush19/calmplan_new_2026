/**
 * ── DesignContext: Global Visual Identity Engine ──
 *
 * Single source of truth for all visual preferences:
 * - Typography (font family)
 * - Theme (light / soft-gray / dark)
 * - Shape (cloud / capsule / hexagon / star / speech / bubble)
 * - Line style (solid / dashed / dotted / tapered)
 * - Glassmorphism toggle
 * - Soft shadows toggle
 * - Map template (ayoa-organic / mindmap-classic / minimalist)
 *
 * All changes persist in localStorage and propagate via CSS variables
 * to every mounted component — no refresh needed.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const LS_KEY = 'calmplan_design_prefs';

const DEFAULTS = {
  fontFamily: 'Heebo',
  theme: 'light',           // light | soft-gray | dark
  shape: 'bubble',          // cloud | capsule | hexagon | star | speech | bubble | pill | diamond | roundedRect
  lineStyle: 'tapered',     // solid | dashed | dotted | tapered
  glassmorphism: false,
  softShadows: true,
  mapTemplate: 'ayoa-organic', // ayoa-organic | mindmap-classic | minimalist
  stickerMap: {},            // nodeId → emoji/icon key
};

// Theme CSS variable maps
const THEME_VARS = {
  light: {
    '--cp-bg': '#FFFFFF',
    '--cp-bg-secondary': '#FAFBFE',
    '--cp-bg-tertiary': '#F5F7FC',
    '--cp-text': '#0F172A',
    '--cp-text-secondary': '#64748B',
    '--cp-border': '#E2E8F0',
    '--cp-card-bg': '#FFFFFF',
    '--cp-card-shadow': '0 1px 3px rgba(0,0,0,0.06)',
    '--cp-glass-bg': 'rgba(255,255,255,0.85)',
    '--cp-glass-border': 'rgba(255,255,255,0.5)',
  },
  'soft-gray': {
    '--cp-bg': '#F0F2F5',
    '--cp-bg-secondary': '#E8EAEE',
    '--cp-bg-tertiary': '#DDE0E5',
    '--cp-text': '#1E293B',
    '--cp-text-secondary': '#475569',
    '--cp-border': '#CBD5E1',
    '--cp-card-bg': '#FFFFFF',
    '--cp-card-shadow': '0 2px 6px rgba(0,0,0,0.08)',
    '--cp-glass-bg': 'rgba(240,242,245,0.88)',
    '--cp-glass-border': 'rgba(255,255,255,0.4)',
  },
  dark: {
    '--cp-bg': '#0F172A',
    '--cp-bg-secondary': '#1E293B',
    '--cp-bg-tertiary': '#334155',
    '--cp-text': '#F1F5F9',
    '--cp-text-secondary': '#94A3B8',
    '--cp-border': '#334155',
    '--cp-card-bg': '#1E293B',
    '--cp-card-shadow': '0 2px 8px rgba(0,0,0,0.3)',
    '--cp-glass-bg': 'rgba(15,23,42,0.85)',
    '--cp-glass-border': 'rgba(51,65,85,0.5)',
  },
};

// Map templates — preset combinations
export const MAP_TEMPLATES = {
  'ayoa-organic': {
    label: 'AYOA אורגני',
    description: 'ענן + קווים טפלים + פסטל',
    shape: 'cloud',
    lineStyle: 'tapered',
    glassmorphism: false,
    softShadows: true,
  },
  'mindmap-classic': {
    label: 'מפת חשיבה קלאסית',
    description: 'כמוסה + בזיה מלאה + צבעים חזקים',
    shape: 'capsule',
    lineStyle: 'solid',
    glassmorphism: false,
    softShadows: true,
  },
  minimalist: {
    label: 'מינימליסטי',
    description: 'מלבנים + קו מקווקו דק + גווני אפור',
    shape: 'roundedRect',
    lineStyle: 'dashed',
    glassmorphism: true,
    softShadows: false,
  },
};

const DesignContext = createContext(null);

export function DesignProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  });

  // Apply CSS variables whenever theme or font changes
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME_VARS[prefs.theme] || THEME_VARS.light;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--cp-font', prefs.fontFamily);

    // Apply glassmorphism class
    if (prefs.glassmorphism) {
      root.classList.add('cp-glass');
    } else {
      root.classList.remove('cp-glass');
    }

    // Dark mode body class
    if (prefs.theme === 'dark') {
      root.classList.add('cp-dark');
    } else {
      root.classList.remove('cp-dark');
    }
  }, [prefs.theme, prefs.fontFamily, prefs.glassmorphism]);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch { /* ignore */ }
  }, [prefs]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyTemplate = useCallback((templateKey) => {
    const t = MAP_TEMPLATES[templateKey];
    if (!t) return;
    setPrefs(prev => ({
      ...prev,
      mapTemplate: templateKey,
      shape: t.shape,
      lineStyle: t.lineStyle,
      glassmorphism: t.glassmorphism,
      softShadows: t.softShadows,
    }));
  }, []);

  const setSticker = useCallback((nodeId, sticker) => {
    setPrefs(prev => ({
      ...prev,
      stickerMap: { ...prev.stickerMap, [nodeId]: sticker },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPrefs({ ...DEFAULTS });
  }, []);

  return (
    <DesignContext.Provider value={{
      ...prefs,
      updatePref,
      applyTemplate,
      setSticker,
      resetToDefaults,
    }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within DesignProvider');
  return ctx;
}

export { THEME_VARS };
