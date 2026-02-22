import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, StickyNote, X } from 'lucide-react';
import QuickAddModal from './QuickAddModal';
import StickyNotesPanel from './StickyNotesPanel';

// Floating Action Hub - always visible in bottom-left corner on ALL pages
// Contains: Quick-Add (+) button and Sticky Notes toggle
export default function FloatingActionHub() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const toggleHub = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const openQuickAdd = useCallback(() => {
    setShowQuickAdd(true);
    setIsExpanded(false);
  }, []);

  const openNotes = useCallback(() => {
    setShowNotes(prev => !prev);
    setIsExpanded(false);
  }, []);

  return (
    <>
      {/* FAB Container - fixed position bottom-left */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col-reverse items-center gap-3">
        {/* Main FAB button */}
        <motion.button
          onClick={toggleHub}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
          }}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {isExpanded ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Plus className="w-6 h-6 text-white" />
            )}
          </motion.div>
        </motion.button>

        {/* Expandable action buttons */}
        <AnimatePresence>
          {isExpanded && (
            <>
              {/* Quick Add Task button */}
              <motion.button
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0 }}
                onClick={openQuickAdd}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg relative group"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                }}
              >
                <Plus className="w-5 h-5 text-white" />
                {/* Label tooltip */}
                <span className="absolute right-14 whitespace-nowrap px-2 py-1 rounded-lg bg-slate-800/90 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  הוספה מהירה
                </span>
              </motion.button>

              {/* Sticky Notes button */}
              <motion.button
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.05 }}
                onClick={openNotes}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg relative group"
                style={{
                  background: showNotes
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #f59e0b, #eab308)',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                }}
              >
                <StickyNote className="w-5 h-5 text-white" />
                {/* Label tooltip */}
                <span className="absolute right-14 whitespace-nowrap px-2 py-1 rounded-lg bg-slate-800/90 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  פתקים מהירים
                </span>
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Notes Panel (floating glass overlay) */}
      <StickyNotesPanel
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
      />
    </>
  );
}
