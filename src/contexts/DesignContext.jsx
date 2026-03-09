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
    isLoaded: false
  });

  useEffect(() => {
    let isMounted = true;

    async function initDesign() {
      // בדיקה קריטית: האם המערכת בכלל מוכנה לעבודה עם Entities?
      // אם UserPreferences.filter מחזיר undefined או no-op, אנחנו פשוט מחכים.
      try {
        if (typeof UserPreferences !== 'undefined' && UserPreferences?.filter) {
          const prefs = await UserPreferences.filter();
          
          // אם חזר מערך ריק או לא תקין בגלל חוסר אתחול, אנחנו עוצרים כאן ולא קורסים
          if (!prefs || !Array.isArray(prefs)) {
            console.log("Waiting for UserPreferences initialization...");
            return; 
          }

          if (isMounted && prefs.length > 0) {
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
        
        // אם הגענו לכאן ואין נתונים, פשוט מסמנים כנטען עם ברירת מחדל
        if (isMounted) setDesignState(prev => ({ ...prev, isLoaded: true }));
      } catch (err) {
        if (isMounted) setDesignState(prev => ({ ...prev, isLoaded: true }));
      }
    }

    // ניסיון אתחול ראשון
    initDesign();

    // האזנה לאירוע שהדאטה סונכרן - זה הטריגר הכי בטוח במערכת שלך
    const handleSync = () => initDesign();
    window.addEventListener('calmplan:data-synced', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('calmplan:data-synced', handleSync);
    };
  }, []);

  const updateDesign = useCallback(async (updates) => {
    setDesignState(prev => ({ ...prev, ...updates }));
    
    try {
      // הגנה גם בזמן עדכון
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
      console.error('Design update failed:', err);
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
