import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '@/api/entities';

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

  // טעינת העדפות מהשרת עם הגנה מפני קריסה
  useEffect(() => {
    async function initDesign() {
      try {
        // בדיקה שהישות מוכנה לפני הרצה
        if (UserPreferences && typeof UserPreferences.filter === 'function') {
          const prefs = await UserPreferences.filter();
          if (prefs && prefs.length > 0) {
            const p = prefs[0];
            setDesignState(prev => ({
              ...prev,
              theme: p.theme || prev.theme,
              lineStyle: p.line_style || prev.lineStyle,
              shape: p.shape || prev.shape,
              curvature: p.curvature ?? prev.curvature,
              isLoaded: true
            }));
          } else {
            setDesignState(prev => ({ ...prev, isLoaded: true }));
          }
        }
      } catch (err) {
        console.error('Design initialization failed:', err);
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    }
    initDesign();
  }, []);

  // עדכון הגדרות ושמירה ל-DB
  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    
    try {
      if (UserPreferences && typeof UserPreferences.update === 'function') {
        // מיפוי שמות המשתנים לפורמט של ה-DB
        const dbUpdates = {};
        if (updates.lineStyle) dbUpdates.line_style = updates.lineStyle;
        if (updates.theme) dbUpdates.theme = updates.theme;
        if (updates.shape) dbUpdates.shape = updates.shape;
        if (updates.curvature !== undefined) dbUpdates.curvature = updates.curvature;

        if (Object.keys(dbUpdates).length > 0) {
          await UserPreferences.update('me', dbUpdates);
        }
      }
    } catch (err) {
      console.error('Failed to persist design updates:', err);
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

  const addCompletionSticker = useCallback((nodeId) => {
    setDesignState(prev => ({
      ...prev,
      stickerMap: { ...prev.stickerMap, [nodeId]: '✅' }
    }));
  }, []);

  // האזנה לאירועים חיצוניים (מ-Automation או Cascade)
  useEffect(() => {
    const handleDesignEvent = (e) => {
      const { nodeId, color, shape } = e.detail;
      if (nodeId) setNodeOverride(nodeId, { color, shape });
    };

    const handleStickerEvent = (e) => {
      if (e.detail.nodeId) addCompletionSticker(e.detail.nodeId);
    };

    window.addEventListener('calmplan:design-changed', handleDesignEvent);
    window.addEventListener('calmplan:task-completed', handleStickerEvent);
    
    return () => {
      window.removeEventListener('calmplan:design-changed', handleDesignEvent);
      window.removeEventListener('calmplan:task-completed', handleStickerEvent);
    };
  }, [setNodeOverride, addCompletionSticker]);

  return (
    <DesignContext.Provider value={{ ...designState, updateDesign, setNodeOverride, addCompletionSticker }}>
      {children}
    </DesignContext.Provider>
  );
};

export const useDesign = () => {
  const context = useContext(DesignContext);
  if (!context) throw new Error('useDesign must be used within DesignProvider');
  return context;
};
