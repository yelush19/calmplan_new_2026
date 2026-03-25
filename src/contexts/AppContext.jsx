import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext();

// Energy-based cognitive load thresholds
// Maps energy level to maximum cognitive_load tier allowed
const ENERGY_LOAD_LIMITS = {
  low: 1,    // Only nano (0) and simple (1) tasks — up to 15 minutes
  medium: 2, // Also moderate (2) tasks
  full: 3,   // All tasks including complex (3)
};

export function AppProvider({ children }) {
  const [workMode, setWorkMode] = useState('doing');
  const [energyLevel, setEnergyLevel] = useState('full');
  const [focusMode, setFocusMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  // Filter tasks by current energy level (cognitive load)
  // Returns only tasks appropriate for current energy state
  const filterByEnergy = useCallback((tasks) => {
    if (!tasks || energyLevel === 'full') return tasks;
    const maxLoad = ENERGY_LOAD_LIMITS[energyLevel] ?? 3;
    return tasks.filter(t => {
      const load = t.cognitive_load ?? t.complexity_tier ?? 1;
      return load <= maxLoad;
    });
  }, [energyLevel]);

  return (
    <AppContext.Provider value={{
      workMode, setWorkMode,
      energyLevel, setEnergyLevel,
      focusMode, setFocusMode,
      activeFilter, setActiveFilter,
      filterByEnergy,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
