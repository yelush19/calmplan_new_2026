import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';

/**
 * ConfirmDialog - ADHD-safe replacement for window.confirm
 * Features:
 * - Clear visual destructive action styling
 * - Configurable delay before confirm button becomes clickable
 * - RTL-friendly Hebrew UI
 */
export function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmText, cancelText, destructive = true, delayMs = 0 }) {
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (open && delayMs > 0) {
      setCountdown(Math.ceil(delayMs / 1000));
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(0);
    }
    return () => clearInterval(timerRef.current);
  }, [open, delayMs]);

  return (
    <AlertDialog open={open} onOpenChange={(val) => { if (!val) onCancel(); }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title || 'אישור פעולה'}</AlertDialogTitle>
          <AlertDialogDescription className="text-right whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel onClick={onCancel}>
            {cancelText || 'ביטול'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={countdown > 0}
            className={destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {countdown > 0 ? `${confirmText || 'אישור'} (${countdown})` : (confirmText || 'אישור')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * useConfirm - React hook for imperative confirm dialogs
 *
 * Usage:
 *   const { confirm, ConfirmDialogComponent } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({ description: 'למחוק את הפריט?' });
 *     if (ok) { ... }
 *   };
 *
 *   return <>{ConfirmDialogComponent}...</>;
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, props: {}, resolve: null });

  const confirm = useCallback((props = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, props, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, props: {}, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, props: {}, resolve: null });
  }, [state.resolve]);

  const ConfirmDialogComponent = (
    <ConfirmDialog
      open={state.open}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      {...state.props}
    />
  );

  return { confirm, ConfirmDialogComponent };
}
