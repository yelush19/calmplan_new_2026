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
    isLoaded: false // חשוב: נשאר false עד שהכל באמת מוכן
  });

  const loadPrefs = useCallback(async () => {
    // בודק פיזית אם הפונקציות קיימות על האובייקט
    const isReady = UserPreferences && typeof UserPreferences.filter === 'function';
    if (!isReady) return false;

    try {
      const prefs = await UserPreferences.filter();
      if (prefs && Array.isArray(prefs) && prefs.length > 0) {
        const p = prefs[0];
        setDesignState(prev => ({
          ...prev,
          theme: p.theme || prev.theme,
          lineStyle: p.line_style || prev.lineStyle,
          shape: p.shape || prev.shape,
          curvature: typeof p.curvature === 'number' ? p.curvature : prev.curvature,
          isLoaded: true
        }));
        return true;
      }
    } catch (e) {
      console.warn("Design fallback used");
    }
    setDesignState(prev => ({ ...prev, isLoaded: true }));
    return true;
  }, []);

  useEffect(() => {
    let timer;
    
    // ניסיון ראשון מידי
    loadPrefs().then(success => {
      if (!success) {
        // אם נכשל (כי Entities לא מוכן), ננסה שוב כל שניה עד שיעבוד
        timer = setInterval(async () => {
          const ok = await loadPrefs();
          if (ok) clearInterval(timer);
        }, 1000);
      }
    });

    return () => clearInterval(timer);
  }, [loadPrefs]);

  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    if (UserPreferences?.update) {
      const dbMap = { lineStyle: 'line_style', theme: 'theme', shape: 'shape', curvature: 'curvature' };
      const toUpdate = {};
      Object.keys(updates).forEach(k => { if(dbMap[k]) toUpdate[dbMap[k]] = updates[k]; });
      if (Object.keys(toUpdate).length > 0) await UserPreferences.update('me', toUpdate);
    }
  }, []);

  return (
    <DesignContext.Provider value={{ ...designState, updateDesign }}>
      {children}
    </DesignContext.Provider>
  );
};

export const useDesign = () => useContext(DesignContext);
