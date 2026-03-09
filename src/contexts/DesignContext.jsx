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

  // טעינת העדפות מהשרת עם הגנה מפני קריסה (Temporal Dead Zone)
  useEffect(() => {
    async function initDesign() {
      try {
        // בדיקה שהישות קיימת ושיש לה פונקציית פילטר לפני שמנסים לקרוא לה
        const hasUserPrefs = typeof UserPreferences !== 'undefined' && 
                             UserPreferences !== null && 
                             typeof UserPreferences.filter === 'function';

        if (hasUserPrefs) {
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
        // אם אין העדפות ב-DB או שהישות לא מוכנה, פשוט מסמנים כנטען עם ברירת מחדל
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      } catch (err) {
        console.warn('Design initialization deferred or failed:', err);
        setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    }
    initDesign();
  }, []);

  // עדכון הגדרות ושמירה ל-DB
  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    
    try {
      if (typeof UserPreferences !== 'undefined' && typeof UserPreferences.update === 'function') {
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

  // מאזיני אירועים לעדכון עיצוב בזמן אמת ממקורות אחרים
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
