/**
 * ── AyoaViewContext: Global view mode state ──
 * Provides a single source of truth for the AYOA 4-view toggle
 * across all pages (P1, P2, P3, MyFocus, etc.)
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const AyoaViewContext = createContext({
  ayoaView: 'radial',
  setAyoaView: () => {},
  showToolbar: true,
  setShowToolbar: () => {},
});

export function AyoaViewProvider({ children }) {
  const [ayoaView, setAyoaView] = useState('radial');
  const [showToolbar, setShowToolbar] = useState(true);

  return (
    <AyoaViewContext.Provider value={{ ayoaView, setAyoaView, showToolbar, setShowToolbar }}>
      {children}
    </AyoaViewContext.Provider>
  );
}

export function useAyoaView() {
  return useContext(AyoaViewContext);
}
