// ═══════════════════════════════════════════════════════════════
// FloatingUndoButton — Stage 5.5
// ═══════════════════════════════════════════════════════════════
//
// Floating pill button in the corner that offers a single "Undo".
// Binds Ctrl+Z / Cmd+Z globally so the user can undo without
// hunting for the mouse.
//
// Positioned bottom-right in RTL (visual corner) — matches the
// user's expectation for "action nearby my thumb" on mobile.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUndo } from '@/contexts/UndoContext';

export default function FloatingUndoButton() {
  const { canUndo, lastLabel, undo } = useUndo();
  const [flash, setFlash] = useState(null);

  // Global Ctrl+Z / Cmd+Z shortcut — but don't hijack while the user
  // is actively editing a text input or contenteditable area.
  useEffect(() => {
    const onKey = async (e) => {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z');
      if (!isUndo) return;
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || t?.isContentEditable;
      if (editable) return;
      if (!canUndo) return;
      e.preventDefault();
      const label = await undo();
      if (label) {
        setFlash(label);
        setTimeout(() => setFlash(null), 2200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, undo]);

  return (
    <AnimatePresence>
      {canUndo && (
        <motion.button
          key="undo-btn"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
          onClick={async () => {
            const label = await undo();
            if (label) {
              setFlash(label);
              setTimeout(() => setFlash(null), 2200);
            }
          }}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0F172A] text-white font-semibold text-sm shadow-lg hover:bg-[#1E293B] transition-colors"
          style={{ direction: 'rtl', fontFamily: 'var(--cp-font, Heebo, sans-serif)' }}
          title="ביטול הפעולה האחרונה — Ctrl+Z"
        >
          <Undo2 className="w-4 h-4" />
          <span>בטל: {lastLabel}</span>
          <kbd className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded font-mono">Ctrl+Z</kbd>
        </motion.button>
      )}
      {flash && (
        <motion.div
          key="undo-flash"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 right-5 z-[60] px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-md"
          style={{ direction: 'rtl' }}
        >
          בוטל: {flash}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
