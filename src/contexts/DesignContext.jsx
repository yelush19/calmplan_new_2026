import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '@/api/entities';

// ייצוא התבניות שחסר וגורם לשגיאת Build
export const MAP_TEMPLATES = {
  modern: { bg: '#f8f9fa', node: 'bubble' },
  organic: { bg: '#ffffff', node: 'cloud' },
  dark: { bg: '#1a1a1a', node: 'rect' }
};

const DesignContext = createContext();

export const DesignProvider = ({ children }) => {
  const [designState, setDesignState] = useState({
    theme: 'modern',
    lineStyle: 'tapered',
    shape: 'bubble',
    curvature: 0.5,
    nodeOverrides: {},
    stickerMap: {},
    activeBranches: [],
    isLoaded: false
  });

  useEffect(() => {
    async function initDesign() {
      try {
        // הגנה מפני קריסה אם הישות עדיין לא נטענה
        if (typeof UserPreferences !== 'undefined' && UserPreferences?.filter) {
          const prefs = await UserPreferences.filter();
          if (prefs && prefs.length > 0) {
            const p = prefs[0];
            setDesignState(prev => ({
              ...prev,
              theme: p.theme || prev.theme,
              lineStyle: p.line_style || prev.lineStyle,
              shape: p.shape || prev.shape,
              curvature: typeof p.curvature === 'number' ? p.curvature : prev.curvature,
              isLoaded: true
            }));
            return;
          }
        }
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      } catch (err) {
        console.warn('Design init deferred');
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    }
    initDesign();
  }, []);

  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    try {
      if (typeof UserPreferences !== 'undefined' && UserPreferences?.update) {
        const dbUpdates = {};
        if (updates.lineStyle) dbUpdates.line_style = updates.lineStyle;
        if (updates.theme) dbUpdates.theme = updates.theme;
        if (updates.shape) dbUpdates.shape = updates.shape;
        if (typeof updates.curvature !== 'undefined') dbUpdates.curvature = updates.curvature;
        await UserPreferences.update('me', dbUpdates);
      }
    } catch (err) {
      console.error('Save failed', err);
    }
  }, []);

  const setNodeOverride = useCallback((nodeId, override) => {
    setDesignState(prev => ({
      ...prev,
      nodeOverrides: {
        ...prev.nodeOverrides,
        [nodeId]: { ...(prev.nodeOverrides[nodeId] || {}), ...override }
      }
    }));
  }, []);

  return (
    <DesignContext.Provider value={{ ...designState, updateDesign, setNodeOverride }}>
      {children}
    </DesignContext.Provider>
  );
};

export const useDesign = () => {
  const context = useContext(DesignContext);
  if (!context) throw new Error('useDesign must be used within DesignProvider');
  return context;
};
