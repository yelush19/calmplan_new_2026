import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '@/api/entities';

// ייצוא התבניות - פותר את שגיאת ה-Build ב-Vercel
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

  // אתחול בטוח עם מנגנון המתנה לישות ה-API
  useEffect(() => {
    let isMounted = true;

    const initDesign = async () => {
      // בדיקה אם הישות קיימת ומוכנה לפעולה (מונע את שגיאת ה-O)
      const isEntityReady = typeof UserPreferences !== 'undefined' && 
                             UserPreferences !== null && 
                             typeof UserPreferences.filter === 'function';

      if (!isEntityReady) {
        // אם לא מוכן, נחכה רגע וננסה שוב
        setTimeout(initDesign, 500);
        return;
      }

      try {
        const prefs = await UserPreferences.filter();
        if (isMounted) {
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
          } else {
            setDesignState(prev => ({ ...prev, isLoaded: true }));
          }
        }
      } catch (err) {
        console.warn('Design settings loaded with defaults');
        if (isMounted) setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    };

    initDesign();
    return () => { isMounted = false; };
  }, []);

  // עדכון ושמירה ל-DB
  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    
    try {
      if (typeof UserPreferences !== 'undefined' && UserPreferences?.update) {
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
      console.error('Failed to save design preferences:', err);
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
