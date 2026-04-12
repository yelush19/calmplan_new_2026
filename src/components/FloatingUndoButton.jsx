// ═══════════════════════════════════════════════════════════════
// FloatingUndoButton — Stage 5.5 (hardened in 5.5c)
// ═══════════════════════════════════════════════════════════════
//
// Floating pill button in the corner that offers a single "Undo".
// Binds Ctrl+Z / Cmd+Z globally so the user can undo without
// hunting for the mouse.
//
// Stage 5.5c — bug fix: the pill used to sit at z-[60], which is
// ABOVE Radix Sheet/Dialog (z-50), so when the user opened an
// "edit task" dialog while a stale undo was still showing, the
// pill would overlap the dialog's save button and block clicks.
//
// Fixes landed here:
//   1. Auto-dismiss the PILL (not the undo action) after 8s. The
//      undo stack stays intact — only the visible affordance goes
//      away. The user can still press Ctrl+Z to recover.
//   2. Hide the pill whenever any Radix dialog / sheet / popover
//      is open (detected via `[role="dialog"][data-state="open"]`).
//      That keeps it from ever colliding with modal buttons.
//   3. Tiny × to dismiss the pill manually.
//   4. Lower z-index from 60 → 40 so the pill sits BELOW modals
//      even if the detection misses.
//
// Positioned bottom-right in RTL (visual corner) — matches the
// user's expectation for "action nearby my thumb" on mobile.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUndo } from '@/contexts/UndoContext';

const AUTO_DISMISS_MS = 8000; // 8 seconds — matches the undo stack's "recent action" feel

export default function FloatingUndoButton() {
  const { canUndo, lastLabel, stack, undo } = useUndo();
  const [flash, setFlash] = useState(null);
  // Dismissed pill state — not cleared until a NEW action gets pushed.
  // Tracks the stack size at the moment of dismissal, so pushing a new
  // undo (which grows the stack) re-shows the pill.
  const [dismissedAtSize, setDismissedAtSize] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Auto-dismiss after AUTO_DISMISS_MS of idle ──
  // Re-arms whenever the top of the stack changes (the "latest label").
  useEffect(() => {
    if (!canUndo) return;
    // New action appeared → un-dismiss if we were hidden
    setDismissedAtSize(prev => (stack.length > prev ? 0 : prev));
    const t = setTimeout(() => {
      setDismissedAtSize(stack.length);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [stack.length, canUndo, lastLabel]);

  // ── Watch the DOM for any open modal (dialog/sheet/popover) ──
  // Using MutationObserver on body so we catch Radix portals too.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const check = () => {
      const open = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
      );
      setModalOpen(!!open);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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

  const handleUndoClick = useCallback(async () => {
    const label = await undo();
    if (label) {
      setFlash(label);
      setTimeout(() => setFlash(null), 2200);
    }
  }, [undo]);

  const handleDismiss = useCallback((e) => {
    e.stopPropagation();
    setDismissedAtSize(stack.length);
  }, [stack.length]);

  const visible =
    canUndo &&
    !modalOpen &&                        // never compete with a dialog
    stack.length > dismissedAtSize;      // not manually / auto-dismissed

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="undo-btn"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-1 bg-[#0F172A] text-white rounded-full shadow-lg"
          style={{ direction: 'rtl', fontFamily: 'var(--cp-font, Heebo, sans-serif)' }}
        >
          <button
            onClick={handleUndoClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full hover:bg-[#1E293B] transition-colors font-semibold text-sm"
            title="ביטול הפעולה האחרונה — Ctrl+Z"
          >
            <Undo2 className="w-4 h-4" />
            <span>בטל: {lastLabel}</span>
            <kbd className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded font-mono">Ctrl+Z</kbd>
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 ml-1 me-1 rounded-full hover:bg-white/10 transition-colors"
            title="הסתר (הפעולה עדיין ב-stack — Ctrl+Z עדיין עובד)"
            aria-label="הסתר כפתור ביטול"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
      {flash && !modalOpen && (
        <motion.div
          key="undo-flash"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 right-5 z-40 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-md"
          style={{ direction: 'rtl' }}
        >
          בוטל: {flash}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
