// ═══════════════════════════════════════════════════════════════
// UndoContext — Stage 5.5
// ═══════════════════════════════════════════════════════════════
//
// Simple LIFO undo stack (max 5 items) for user-visible actions:
//   - task delete     → restore the task
//   - status change   → revert to the previous status
//   - task edit       → restore the previous field values
//   - sticky delete   → restore the note
//
// Actions push() a handler that knows how to undo themselves. The
// FloatingUndoButton + Ctrl+Z shortcut both call undo(), which pops
// the newest action and runs it.
//
// Non-goals: redo, cross-tab sync, persistence. If the user
// reloads the page, the stack is cleared — by design (ADHD-first:
// stale undo history is its own form of noise).
// ═══════════════════════════════════════════════════════════════

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const MAX_STACK = 5;
const UndoContext = createContext(null);

export function UndoProvider({ children }) {
  const [stack, setStack] = useState([]);
  const runningRef = useRef(false);

  /**
   * Push a new undoable action.
   * @param {{ label: string, undo: () => (void | Promise<void>), icon?: string }} action
   */
  const pushUndo = useCallback((action) => {
    if (!action || typeof action.undo !== 'function') return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: action.label || 'פעולה',
      icon: action.icon || null,
      undo: action.undo,
      at: Date.now(),
    };
    setStack(prev => {
      const next = [...prev, entry];
      // Cap the stack — drop oldest entries first.
      while (next.length > MAX_STACK) next.shift();
      return next;
    });
  }, []);

  /**
   * Pop the newest action and run its undo handler.
   * Returns the label of the action that was undone (or null).
   */
  const undo = useCallback(async () => {
    if (runningRef.current) return null;
    let popped = null;
    setStack(prev => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    if (!popped) return null;
    runningRef.current = true;
    try {
      await popped.undo();
    } catch (err) {
      // If the undo handler blows up, we've already removed it from the
      // stack — log it and move on. ADHD-first: never let undo errors
      // re-open a modal that the user was trying to dismiss.
      // eslint-disable-next-line no-console
      console.warn('[UndoContext] undo handler failed:', err);
    } finally {
      runningRef.current = false;
    }
    return popped.label;
  }, []);

  const clear = useCallback(() => setStack([]), []);

  return (
    <UndoContext.Provider value={{
      stack,
      canUndo: stack.length > 0,
      lastLabel: stack.length > 0 ? stack[stack.length - 1].label : null,
      pushUndo,
      undo,
      clear,
    }}>
      {children}
    </UndoContext.Provider>
  );
}

// Safe fallback if consumed outside the provider (prevents crashes).
const SAFE_FALLBACK = {
  stack: [],
  canUndo: false,
  lastLabel: null,
  pushUndo: () => {},
  undo: async () => null,
  clear: () => {},
};

export function useUndo() {
  const ctx = useContext(UndoContext);
  return ctx || SAFE_FALLBACK;
}
