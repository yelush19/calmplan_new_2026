import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [workMode, setWorkMode] = useState('doing');
  const [energyLevel, setEnergyLevel] = useState('full');
  const [focusMode, setFocusMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  return (
    <AppContext.Provider value={{
      workMode, setWorkMode,
      energyLevel, setEnergyLevel,
      focusMode, setFocusMode,
      activeFilter, setActiveFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
