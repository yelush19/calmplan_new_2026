import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '@/api/entities';

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
    isLoaded: false
  });

  // מנגנון אתחול בטוח
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;

    async function initDesign() {
      // בדיקה אם הישות קיימת ומוכנה לפעולה
      const isEntityReady = typeof UserPreferences !== 'undefined' && 
                             UserPreferences !== null && 
                             typeof UserPreferences.filter === 'function';

      if (isEntityReady) {
        try {
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
        } catch (err) {
          console.warn('Preferences filter failed, using defaults');
        }
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      } else if (retryCount < maxRetries) {
        // אם הישות עוד לא נטענה (race condition), נחכה חצי שנייה וננסה שוב
        retryCount++;
        setTimeout(initDesign, 500);
      } else {
        // ויתור ושימוש בברירת מחדל כדי לא לתקוע את האפליקציה
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    }

    initDesign();
  }, []);

  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    
    try {
      const canUpdate = typeof UserPreferences !== 'undefined' && 
                        UserPreferences?.update;

      if (canUpdate) {
        const dbUpdates = {};
        if (updates.lineStyle) dbUpdates.line_style = updates.lineStyle;
        if (updates.theme) dbUpdates.theme = updates.theme;
        if (updates.shape) dbUpdates.shape = updates.shape;
        if (typeof updates.curvature !== 'undefined') dbUpdates.curvature = updates.curvature;

        if (Object.keys(dbUpdates).length > 0) {
          await UserPreferences.update('me', dbUpdates);
        }
      }
    } catch (err) {
      console.error('Persistence failed:', err);
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
