import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { StickyNote } from '@/api/entities';

const NOTE_COLORS = [
  { id: 'yellow', bg: 'bg-amber-400/90', border: 'border-amber-300', text: 'text-amber-950' },
  { id: 'green', bg: 'bg-emerald-400/90', border: 'border-emerald-300', text: 'text-emerald-950' },
  { id: 'blue', bg: 'bg-sky-400/90', border: 'border-sky-300', text: 'text-sky-950' },
  { id: 'pink', bg: 'bg-pink-400/90', border: 'border-pink-300', text: 'text-pink-950' },
  { id: 'purple', bg: 'bg-violet-400/90', border: 'border-violet-300', text: 'text-violet-950' },
];

function getColorStyle(colorId) {
  return NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
}

export default function StickyNotesPanel({ isOpen, onClose }) {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const newNoteRef = useRef(null);

  // Load notes
  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const data = await StickyNote.list();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading sticky notes:', err);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async () => {
    const colorIndex = notes.length % NOTE_COLORS.length;
    try {
      const newNote = await StickyNote.create({
        content: '',
        color: NOTE_COLORS[colorIndex].id,
        created_at: new Date().toISOString(),
        order: notes.length,
      });
      setNotes(prev => [...prev, newNote]);
      // Focus the new note's textarea after render
      setTimeout(() => {
        newNoteRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const updateNote = async (noteId, content) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content } : n));
    // Debounced save
    try {
      await StickyNote.update(noteId, { content });
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const deleteNote = async (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await StickyNote.delete(noteId);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const cycleColor = async (noteId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const currentIndex = NOTE_COLORS.findIndex(c => c.id === note.color);
    const nextColor = NOTE_COLORS[(currentIndex + 1) % NOTE_COLORS.length].id;
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, color: nextColor } : n));
    try {
      await StickyNote.update(noteId, { color: nextColor });
    } catch (err) {
      console.error('Error updating note color:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 40, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 40, y: 40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-24 left-4 z-[55] w-80 max-h-[70vh] flex flex-col"
          dir="rtl"
        >
          {/* Panel container - glassmorphism */}
          <div className="rounded-2xl border border-white/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                📌 פתקים מהירים
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={addNote}
                  className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-white/10 transition-colors"
                  title="הוסף פתק"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm mb-3">אין פתקים עדיין</p>
                  <button
                    onClick={addNote}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-colors"
                  >
                    + הוסף פתק ראשון
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {notes.map((note, idx) => {
                    const colorStyle = getColorStyle(note.color);
                    const isLast = idx === notes.length - 1;
                    return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, height: 0 }}
                        className={`rounded-xl ${colorStyle.bg} ${colorStyle.border} border shadow-md overflow-hidden`}
                      >
                        {/* Note toolbar */}
                        <div className="flex items-center justify-between px-2 pt-1.5">
                          <button
                            onClick={() => cycleColor(note.id)}
                            className={`w-4 h-4 rounded-full border-2 border-white/30 ${colorStyle.bg} hover:scale-110 transition-transform`}
                            title="שנה צבע"
                          />
                          <button
                            onClick={() => deleteNote(note.id)}
                            className={`p-0.5 rounded ${colorStyle.text} opacity-40 hover:opacity-100 transition-opacity`}
                            title="מחק"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Note content */}
                        <textarea
                          ref={isLast ? newNoteRef : undefined}
                          value={note.content || ''}
                          onChange={(e) => updateNote(note.id, e.target.value)}
                          placeholder="כתוב כאן..."
                          className={`w-full px-3 pb-2.5 pt-1 bg-transparent ${colorStyle.text} text-sm resize-none outline-none placeholder:opacity-40`}
                          style={{
                            fontFamily: "'Varela Round', 'Assistant', sans-serif",
                            minHeight: '48px',
                            maxHeight: '120px',
                          }}
                          rows={2}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {notes.length > 0 && (
              <div className="px-4 py-2 border-t border-white/10 shrink-0">
                <span className="text-white/30 text-[10px]">{notes.length} פתקים</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
