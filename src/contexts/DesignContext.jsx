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

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ServiceCatalog } from '@/api/entities';

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
  nodeOverrides: {},         // nodeId → { shape, color } — per-node style overrides (cross-page)
  // ── Branch Color Engine: P1-P5 customizable colors ──
  branchColors: {
    P1: '#00A3E0',   // שכר — Sky Blue
    P2: '#4682B4',   // הנה"ח — Steel Blue
    P3: '#E91E63',   // ניהול — Magenta
    P4: '#FFC107',   // בית/אישי — Warm Amber (hard default)
    P5: '#2E7D32',   // דוחות — Forest Green
  },
  // ── Automation control ──
  automationsPaused: false,
  cognitiveLoadLimit: 480,   // minutes — daily focus threshold
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

  // Load node overrides from DB on startup (merge with localStorage)
  useEffect(() => {
    ServiceCatalog.list().then(items => {
      if (!items?.length) return;
      const dbOverrides = {};
      const dbStickers = {};
      for (const item of items) {
        if (!item.key) continue;
        if (item.color || item.shape) {
          dbOverrides[item.key] = {
            ...(item.color ? { color: item.color } : {}),
            ...(item.shape ? { shape: item.shape } : {}),
          };
        }
        if (item.sticker) dbStickers[item.key] = item.sticker;
      }
      if (Object.keys(dbOverrides).length > 0 || Object.keys(dbStickers).length > 0) {
        setPrefs(prev => ({
          ...prev,
          nodeOverrides: { ...dbOverrides, ...prev.nodeOverrides },
          stickerMap: { ...dbStickers, ...prev.stickerMap },
        }));
      }
    }).catch(() => {});
  }, []);

  // Apply CSS variables whenever theme, font, or branch colors change
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME_VARS[prefs.theme] || THEME_VARS.light;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--cp-font', prefs.fontFamily);

    // Branch color CSS variables — available everywhere
    if (prefs.branchColors) {
      Object.entries(prefs.branchColors).forEach(([branch, color]) => {
        root.style.setProperty(`--cp-${branch.toLowerCase()}`, color);
      });
    }

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
  }, [prefs.theme, prefs.fontFamily, prefs.glassmorphism, prefs.branchColors]);

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

  // Per-node style override (shape, color) — persisted to localStorage + DB
  const setNodeOverride = useCallback((nodeId, overrideProps) => {
    setPrefs(prev => ({
      ...prev,
      nodeOverrides: {
        ...prev.nodeOverrides,
        [nodeId]: { ...(prev.nodeOverrides?.[nodeId] || {}), ...overrideProps },
      },
    }));
    // Persist to ServiceCatalog DB (non-blocking)
    if (overrideProps.color || overrideProps.shape) {
      ServiceCatalog.filter({ key: nodeId }).then(results => {
        if (results?.[0]) {
          const updates = {};
          if (overrideProps.color) updates.color = overrideProps.color;
          if (overrideProps.shape) updates.shape = overrideProps.shape;
          ServiceCatalog.update(results[0].id, updates);
        }
      }).catch(() => {});
    }
  }, []);

  const getNodeOverride = useCallback((nodeId) => {
    return prefs.nodeOverrides?.[nodeId] || null;
  }, [prefs.nodeOverrides]);

  // ── Global Active Task Selection ──
  // Tracks which node is currently selected across ALL views.
  const [activeTaskId, setActiveTaskId] = useState(null);

  // Listen for node-selected events from any canvas view
  useEffect(() => {
    const handler = (e) => {
      const nodeId = e.detail?.nodeId;
      if (nodeId) setActiveTaskId(nodeId);
    };
    window.addEventListener('calmplan:node-selected', handler);
    return () => window.removeEventListener('calmplan:node-selected', handler);
  }, []);

  /**
   * updateTaskStyle — the single function Design Panel buttons call.
   * Applies shape/color/sticker to the currently selected activeTaskId.
   * Works across ALL views because nodeOverrides and stickerMap are global.
   */
  const updateTaskStyle = useCallback((overrides) => {
    const targetId = overrides?.targetId || activeTaskId;
    if (!targetId) return;
    const { shape, color, sticker, ...rest } = overrides || {};
    if (shape || color) {
      setPrefs(prev => ({
        ...prev,
        nodeOverrides: {
          ...prev.nodeOverrides,
          [targetId]: {
            ...(prev.nodeOverrides?.[targetId] || {}),
            ...(shape ? { shape } : {}),
            ...(color ? { color } : {}),
          },
        },
      }));
      // Persist to ServiceCatalog DB (non-blocking)
      const dbUpdates = {};
      if (shape) dbUpdates.shape = shape;
      if (color) dbUpdates.color = color;
      ServiceCatalog.filter({ key: targetId }).then(results => {
        if (results?.[0]) ServiceCatalog.update(results[0].id, dbUpdates);
      }).catch(() => {});
    }
    if (sticker !== undefined) {
      setPrefs(prev => ({
        ...prev,
        stickerMap: { ...prev.stickerMap, [targetId]: sticker },
      }));
      // Persist sticker to ServiceCatalog DB
      ServiceCatalog.filter({ key: targetId }).then(results => {
        if (results?.[0]) ServiceCatalog.update(results[0].id, { sticker });
      }).catch(() => {});
    }
    // Emit global event so Settings page knows design changed
    window.dispatchEvent(new CustomEvent('calmplan:design-changed', { detail: { targetId, shape, color, sticker } }));
  }, [activeTaskId]);

  const clearSelection = useCallback(() => {
    setActiveTaskId(null);
  }, []);

  const resetToDefaults = useCallback(() => {
    setPrefs({ ...DEFAULTS });
  }, []);

  // Get branch color by P-key (P1, P2, etc.)
  const getBranchColor = useCallback((branch) => {
    return prefs.branchColors?.[branch] || DEFAULTS.branchColors[branch] || '#64748B';
  }, [prefs.branchColors]);

  // Set a single branch color
  const setBranchColor = useCallback((branch, color) => {
    setPrefs(prev => ({
      ...prev,
      branchColors: { ...prev.branchColors, [branch]: color },
    }));
  }, []);

  return (
    <DesignContext.Provider value={{
      ...prefs,
      updatePref,
      applyTemplate,
      setSticker,
      setNodeOverride,
      getNodeOverride,
      resetToDefaults,
      getBranchColor,
      setBranchColor,
      activeTaskId,
      setActiveTaskId,
      updateTaskStyle,
      clearSelection,
    }}>
      {children}
    </DesignContext.Provider>
  );
}

// Safe fallback object when used outside DesignProvider (prevents TDZ / crash)
const SAFE_FALLBACK = {
  ...DEFAULTS,
  updatePref: () => {},
  applyTemplate: () => {},
  setSticker: () => {},
  setNodeOverride: () => {},
  getNodeOverride: () => null,
  resetToDefaults: () => {},
  getBranchColor: (b) => DEFAULTS.branchColors[b] || '#64748B',
  setBranchColor: () => {},
  activeTaskId: null,
  setActiveTaskId: () => {},
  updateTaskStyle: () => {},
  clearSelection: () => {},
};

export function useDesign() {
  const ctx = useContext(DesignContext);
  return ctx || SAFE_FALLBACK;
}

export { THEME_VARS };
