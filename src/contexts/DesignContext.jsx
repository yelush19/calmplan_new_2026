/**
 * -- DesignContext: Global Visual Identity Engine --
 *
 * Single source of truth for all visual preferences:
 * - Typography (font family)
 * - Theme (light / soft-gray / dark)
 * - Shape (cloud / capsule / hexagon / star / speech / bubble)
 * - Line style (solid / dashed / dotted / tapered / tapered-dashed / tapered-dotted)
 * - Curvature (0-0.5 organic control from Design Panel)
 * - Glassmorphism toggle
 * - Soft shadows toggle
 * - Map template (ayoa-organic / mindmap-classic / minimalist)
 *
 * All changes persist in localStorage, propagate via CSS variables,
 * AND save to UserPreferences DB so the map doesn't reset on refresh.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ServiceCatalog, UserPreferences } from '@/api/entities';

const LS_KEY = 'calmplan_design_prefs';
const USER_PREFS_KEY = 'calmplan_global_design';

const DEFAULTS = {
  fontFamily: 'Heebo',
  theme: 'light',           // light | soft-gray | dark
  shape: 'bubble',          // cloud | capsule | hexagon | star | speech | bubble | pill | diamond | roundedRect
  lineStyle: 'tapered',     // solid | dashed | dotted | tapered | tapered-dashed | tapered-dotted
  curvature: 0.25,          // 0 = straight, 0.5 = very organic (linked to Design Panel)
  glassmorphism: false,
  softShadows: true,
  mapTemplate: 'ayoa-organic', // ayoa-organic | mindmap-classic | minimalist
  fillMode: 'filled',        // 'filled' | 'border' -- Fill Mode Toggle
  stickerMap: {},            // nodeId -> emoji/icon key
  nodeOverrides: {},         // nodeId -> { shape, color, lineStyle } -- per-node style overrides (cross-page)
  // -- Branch Color Engine: P1-P5 customizable colors --
  branchColors: {
    P1: '#00A3E0',   // Sky Blue
    P2: '#4682B4',   // Steel Blue
    P3: '#E91E63',   // Magenta
    P4: '#FFC107',   // Warm Amber (hard default)
    P5: '#2E7D32',   // Forest Green
  },
  // -- Automation control --
  automationsPaused: false,
  cognitiveLoadLimit: 480,   // minutes -- daily focus threshold
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

// Map templates -- preset combinations
export const MAP_TEMPLATES = {
  'ayoa-organic': {
    label: 'AYOA \u05d0\u05d5\u05e8\u05d2\u05e0\u05d9',
    description: '\u05e2\u05e0\u05e3 + \u05e7\u05d5\u05d5\u05d9\u05dd \u05d8\u05e4\u05dc\u05d9\u05dd + \u05e4\u05e1\u05d8\u05dc',
    shape: 'cloud',
    lineStyle: 'tapered',
    curvature: 0.25,
    glassmorphism: false,
    softShadows: true,
  },
  'mindmap-classic': {
    label: '\u05de\u05e4\u05ea \u05d7\u05e9\u05d9\u05d1\u05d4 \u05e7\u05dc\u05e1\u05d9\u05ea',
    description: '\u05db\u05de\u05d5\u05e1\u05d4 + \u05d1\u05d6\u05d9\u05d4 \u05de\u05dc\u05d0\u05d4 + \u05e6\u05d1\u05e2\u05d9\u05dd \u05d7\u05d6\u05e7\u05d9\u05dd',
    shape: 'capsule',
    lineStyle: 'solid',
    curvature: 0.15,
    glassmorphism: false,
    softShadows: true,
  },
  minimalist: {
    label: '\u05de\u05d9\u05e0\u05d9\u05de\u05dc\u05d9\u05e1\u05d8\u05d9',
    description: '\u05de\u05dc\u05d1\u05e0\u05d9\u05dd + \u05e7\u05d5 \u05de\u05e7\u05d5\u05d5\u05e7\u05d5 \u05d3\u05e7 + \u05d2\u05d5\u05d5\u05e0\u05d9 \u05d0\u05e4\u05d5\u05e8',
    shape: 'roundedRect',
    lineStyle: 'dashed',
    curvature: 0.1,
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

  // Track DB prefs record ID for updates
  const dbPrefsIdRef = useRef(null);
  // Guard: true once initial DB load completes (prevents writes before load)
  const dbLoadedRef = useRef(false);
  // Guard: true while a DB write is in-flight (prevents concurrent writes)
  const dbWritingRef = useRef(false);
  // Pending payload: queued while a write is in-flight
  const dbPendingRef = useRef(null);

  // Load node overrides from DB on startup (merge with localStorage)
  useEffect(() => {
    // Load per-node overrides from ServiceCatalog
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

    // Load global design prefs from UserPreferences DB (lineStyle, curvature, theme, branchColors, etc.)
    UserPreferences.filter({ key: USER_PREFS_KEY }).then(results => {
      if (results?.[0]) {
        dbPrefsIdRef.current = results[0].id;
        const dbPrefs = {};
        if (results[0].line_style) dbPrefs.lineStyle = results[0].line_style;
        if (results[0].curvature != null) dbPrefs.curvature = results[0].curvature;
        if (results[0].theme) dbPrefs.theme = results[0].theme;
        if (results[0].shape) dbPrefs.shape = results[0].shape;
        if (results[0].font_family) dbPrefs.fontFamily = results[0].font_family;
        // Restore branch colors from DB (P1-P5 customized colors)
        if (results[0].branch_colors && typeof results[0].branch_colors === 'object') {
          dbPrefs.branchColors = { ...DEFAULTS.branchColors, ...results[0].branch_colors };
        }
        if (Object.keys(dbPrefs).length > 0) {
          setPrefs(prev => ({ ...prev, ...dbPrefs }));
        }
      }
    }).catch(() => {}).finally(() => {
      dbLoadedRef.current = true;
    });
  }, []);

  // Apply CSS variables whenever theme, font, or branch colors change
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME_VARS[prefs.theme] || THEME_VARS.light;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--cp-font', prefs.fontFamily);
    // Curvature CSS variable for use in animations/transitions
    root.style.setProperty('--cp-curvature', String(prefs.curvature));

    // Branch color CSS variables -- available everywhere
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
  }, [prefs.theme, prefs.fontFamily, prefs.glassmorphism, prefs.branchColors, prefs.curvature]);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch { /* ignore */ }
  }, [prefs]);

  // -- Save Logic: Persist global design prefs to UserPreferences DB --
  // Uses upsert-with-fallback pattern: update → fallback to create on failure.
  // Serialized writes: only one DB call at a time, pending payloads merged.
  const persistToDb = useCallback((updates) => {
    // Don't write before initial load completes (prevents race condition)
    if (!dbLoadedRef.current) return;

    const dbPayload = {};
    if (updates.lineStyle !== undefined) dbPayload.line_style = updates.lineStyle;
    if (updates.curvature !== undefined) dbPayload.curvature = updates.curvature;
    if (updates.theme !== undefined) dbPayload.theme = updates.theme;
    if (updates.shape !== undefined) dbPayload.shape = updates.shape;
    if (updates.fontFamily !== undefined) dbPayload.font_family = updates.fontFamily;
    if (updates.branchColors !== undefined) dbPayload.branch_colors = updates.branchColors;
    if (Object.keys(dbPayload).length === 0) return;

    // If a write is in-flight, merge into pending queue (will flush after current write)
    if (dbWritingRef.current) {
      dbPendingRef.current = { ...(dbPendingRef.current || {}), ...dbPayload };
      return;
    }

    dbWritingRef.current = true;

    const doWrite = async (payload) => {
      try {
        if (dbPrefsIdRef.current) {
          // Try update first
          try {
            await UserPreferences.update(dbPrefsIdRef.current, payload);
            return; // success
          } catch {
            // Update failed (record missing / RLS / 406) — clear stale ID, fall through to create
            dbPrefsIdRef.current = null;
          }
        }
        // Create new record
        try {
          const result = await UserPreferences.create({ key: USER_PREFS_KEY, ...payload });
          if (result?.id) dbPrefsIdRef.current = result.id;
        } catch {
          // Create also failed (Supabase down / RLS) — silently give up, localStorage is still saved
        }
      } finally {
        dbWritingRef.current = false;
        // Flush any pending payload that accumulated during this write
        if (dbPendingRef.current) {
          const pending = dbPendingRef.current;
          dbPendingRef.current = null;
          persistToDb(
            // Convert DB field names back to pref keys for the recursive call
            Object.fromEntries(Object.entries(pending).map(([k, v]) => {
              if (k === 'line_style') return ['lineStyle', v];
              if (k === 'font_family') return ['fontFamily', v];
              if (k === 'branch_colors') return ['branchColors', v];
              return [k, v];
            }))
          );
        }
      }
    };

    doWrite(dbPayload);
  }, []);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    // Persist design-critical prefs to DB so the map doesn't reset on refresh
    const DB_KEYS = ['lineStyle', 'curvature', 'theme', 'shape', 'fontFamily', 'branchColors'];
    if (DB_KEYS.includes(key)) {
      persistToDb({ [key]: value });
    }
  }, [persistToDb]);

  const applyTemplate = useCallback((templateKey) => {
    const t = MAP_TEMPLATES[templateKey];
    if (!t) return;
    const updates = {
      mapTemplate: templateKey,
      shape: t.shape,
      lineStyle: t.lineStyle,
      curvature: t.curvature ?? DEFAULTS.curvature,
      glassmorphism: t.glassmorphism,
      softShadows: t.softShadows,
    };
    setPrefs(prev => ({ ...prev, ...updates }));
    persistToDb(updates);
  }, [persistToDb]);

  const setSticker = useCallback((nodeId, sticker) => {
    setPrefs(prev => ({
      ...prev,
      stickerMap: { ...prev.stickerMap, [nodeId]: sticker },
    }));
    // Persist sticker to ServiceCatalog DB
    ServiceCatalog.filter({ key: nodeId }).then(results => {
      if (results?.[0]) ServiceCatalog.update(results[0].id, { sticker });
    }).catch(() => {});
  }, []);

  // Per-node style override (shape, color, lineStyle) -- persisted to localStorage + DB
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

  // -- Global Active Task Selection --
  // Tracks which node is currently selected across ALL views.
  const [activeTaskId, setActiveTaskId] = useState(null);

  // -- Active Branches for pulse animation --
  const [activeBranches, setActiveBranches] = useState(new Set());

  // Listen for node-selected events from any canvas view
  useEffect(() => {
    const handler = (e) => {
      const nodeId = e.detail?.nodeId;
      if (nodeId) setActiveTaskId(nodeId);
    };
    window.addEventListener('calmplan:node-selected', handler);
    return () => window.removeEventListener('calmplan:node-selected', handler);
  }, []);

  // Listen for active-branches updates from AutomationEngine
  useEffect(() => {
    const handler = (e) => {
      const branches = e.detail?.branches;
      if (branches) setActiveBranches(new Set(branches));
    };
    window.addEventListener('calmplan:active-branches', handler);
    return () => window.removeEventListener('calmplan:active-branches', handler);
  }, []);

  // -- Cognitive Load auto-theme: switch to soft-gray when overloaded --
  useEffect(() => {
    const handler = (e) => {
      const { overloaded } = e.detail || {};
      if (overloaded) {
        setPrefs(prev => {
          // Only auto-switch if not already on soft-gray
          if (prev.theme === 'soft-gray' && !prev.softShadows) return prev;
          return { ...prev, theme: 'soft-gray', softShadows: false };
        });
      }
    };
    window.addEventListener('calmplan:cognitive-overload', handler);
    return () => window.removeEventListener('calmplan:cognitive-overload', handler);
  }, []);

  /**
   * updateTaskStyle -- the single function Design Panel buttons call.
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

  // -- Sticker Automation: auto-add checkmark when task completes --
  const addCompletionSticker = useCallback((taskId) => {
    if (!taskId) return;
    setPrefs(prev => ({
      ...prev,
      stickerMap: { ...prev.stickerMap, [taskId]: '\u2705' },
    }));
    ServiceCatalog.filter({ key: taskId }).then(results => {
      if (results?.[0]) ServiceCatalog.update(results[0].id, { sticker: '\u2705' });
    }).catch(() => {});
  }, []);

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

  // Set a single branch color — updates state + CSS var + DB in one shot
  const setBranchColor = useCallback((branch, color) => {
    setPrefs(prev => {
      const newBranchColors = { ...prev.branchColors, [branch]: color };
      // Immediate CSS variable update (no wait for useEffect cycle)
      document.documentElement.style.setProperty(`--cp-${branch.toLowerCase()}`, color);
      // Persist full branchColors object to DB
      persistToDb({ branchColors: newBranchColors });
      return { ...prev, branchColors: newBranchColors };
    });
  }, [persistToDb]);

  // Check if a branch is currently active (has in-progress work)
  const isBranchActive = useCallback((branchKey) => {
    return activeBranches.has(branchKey);
  }, [activeBranches]);

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
      activeBranches,
      isBranchActive,
      addCompletionSticker,
    }}>
      {children}
    </DesignContext.Provider>
  );
}

// Safe fallback object when used outside DesignProvider (prevents TDZ / crash)
const SAFE_FALLBACK = {
  ...DEFAULTS,
  fillMode: 'filled',
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
  activeBranches: new Set(),
  isBranchActive: () => false,
  addCompletionSticker: () => {},
};

export function useDesign() {
  const ctx = useContext(DesignContext);
  return ctx || SAFE_FALLBACK;
}

export { THEME_VARS };
