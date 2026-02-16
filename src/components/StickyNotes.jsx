import React, { useState, useEffect } from 'react';
import { StickyNote, Client } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Pin, PinOff, Trash2, Link2, Edit3, Check, User, Calendar, Tag } from 'lucide-react';

const NOTE_COLORS = [
  { key: 'yellow', bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900', hover: 'hover:bg-amber-200', ring: 'ring-amber-400' },
  { key: 'pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900', hover: 'hover:bg-pink-200', ring: 'ring-pink-400' },
  { key: 'blue', bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-900', hover: 'hover:bg-sky-200', ring: 'ring-sky-400' },
  { key: 'green', bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900', hover: 'hover:bg-emerald-200', ring: 'ring-emerald-400' },
  { key: 'purple', bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-900', hover: 'hover:bg-violet-200', ring: 'ring-violet-400' },
];

function getColorConfig(colorKey) {
  return NOTE_COLORS.find(c => c.key === colorKey) || NOTE_COLORS[0];
}

const URGENCY_OPTIONS = [
  { value: 'none', label: 'ללא', color: 'bg-gray-100 text-gray-600' },
  { value: 'low', label: 'נמוך', color: 'bg-blue-100 text-blue-700' },
  { value: 'medium', label: 'בינוני', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'גבוה', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'דחוף', color: 'bg-rose-100 text-rose-700' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'ללא' },
  { value: 'admin', label: 'אדמיניסטרציה' },
  { value: 'marketing', label: 'שיווק' },
  { value: 'personal', label: 'אישי' },
  { value: 'client_work', label: 'עבודה ללקוח' },
];

export default function StickyNotes({ compact = false, onTaskLink }) {
  const [notes, setNotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('yellow');
  const [newClientName, setNewClientName] = useState('');
  const [newUrgency, setNewUrgency] = useState('none');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadNotes();
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const allClients = await Client.list(null, 500);
      setClients((allClients || []).filter(c => c.status === 'active').sort((a, b) => a.name?.localeCompare(b.name, 'he')));
    } catch {
      setClients([]);
    }
  };

  const loadNotes = async () => {
    try {
      const allNotes = await StickyNote.list('created_date', 500);
      // Sort: pinned first, then by created_date desc
      const sorted = (allNotes || []).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_date) - new Date(a.created_date);
      });
      setNotes(sorted);
    } catch {
      setNotes([]);
    }
  };

  const createNote = async () => {
    if (!newTitle.trim() && !newContent.trim()) return;
    await StickyNote.create({
      title: newTitle.trim() || 'פתק חדש',
      content: newContent.trim(),
      color: newColor,
      pinned: false,
      linked_task_id: null,
      linked_task_title: null,
      client_name: newClientName || null,
      urgency: newUrgency !== 'none' ? newUrgency : null,
      due_date: newDueDate || null,
      category: newCategory || null,
      order: Date.now(),
    });
    setNewTitle('');
    setNewContent('');
    setNewColor('yellow');
    setNewClientName('');
    setNewUrgency('none');
    setNewDueDate('');
    setNewCategory('');
    setIsAdding(false);
    loadNotes();
  };

  const togglePin = async (note) => {
    await StickyNote.update(note.id, { pinned: !note.pinned });
    loadNotes();
  };

  const deleteNote = async (id) => {
    await StickyNote.delete(id);
    loadNotes();
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content || '');
  };

  const saveEdit = async (id) => {
    await StickyNote.update(id, {
      title: editTitle.trim() || 'פתק',
      content: editContent.trim(),
    });
    setEditingId(null);
    loadNotes();
  };

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);
  const displayNotes = compact ? [...pinnedNotes, ...unpinnedNotes.slice(0, 3)] : [...pinnedNotes, ...unpinnedNotes];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          <Pin className="w-5 h-5 text-amber-500" />
          פתקים
          {notes.length > 0 && <span className="text-sm font-normal text-gray-400">({notes.length})</span>}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {/* Add New Note Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 space-y-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="כותרת הפתק..."
                className="bg-white/80 border-amber-200 text-base"
                autoFocus
              />
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="תוכן..."
                className="bg-white/80 border-amber-200 text-sm min-h-[60px]"
                rows={2}
              />
              {/* Extra fields row */}
              <div className="grid grid-cols-2 gap-2">
                <Select value={newClientName || '__none__'} onValueChange={(v) => setNewClientName(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="bg-white/80 border-amber-200 text-sm h-9">
                    <SelectValue placeholder="לקוח (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא לקוח</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newCategory || '__none__'} onValueChange={(v) => setNewCategory(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="bg-white/80 border-amber-200 text-sm h-9">
                    <SelectValue placeholder="קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value || '__none__'} value={c.value || '__none__'}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newUrgency} onValueChange={setNewUrgency}>
                  <SelectTrigger className="bg-white/80 border-amber-200 text-sm h-9">
                    <SelectValue placeholder="דחיפות" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-white/80 border-amber-200 text-sm h-9"
                  placeholder="תאריך יעד"
                />
              </div>
              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">צבע:</span>
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setNewColor(c.key)}
                    className={`w-6 h-6 rounded-full ${c.bg} ${c.border} border-2 transition-all ${
                      newColor === c.key ? `ring-2 ${c.ring} scale-110` : ''
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>ביטול</Button>
                <Button size="sm" onClick={createNote} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Plus className="w-3 h-3 ml-1" />
                  צור פתק
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Grid */}
      {notes.length === 0 && !isAdding && (
        <div className="text-center py-6 text-gray-400 text-sm">
          <Pin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>אין פתקים עדיין</p>
          <p className="text-xs mt-1">צרו פתק כדי שדברים לא יפלו</p>
        </div>
      )}

      <div className={compact ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        <AnimatePresence>
          {displayNotes.map((note) => {
            const color = getColorConfig(note.color);
            const isEditing = editingId === note.id;

            return (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`relative p-3 rounded-xl border-2 ${color.bg} ${color.border} ${color.text} shadow-sm transition-all group`}
              >
                {/* Pin indicator */}
                {note.pinned && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow">
                    <Pin className="w-3 h-3 text-white" />
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-white/60 border-current text-sm font-bold"
                      autoFocus
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="bg-white/60 border-current text-xs min-h-[40px]"
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-xs h-7">ביטול</Button>
                      <Button size="sm" onClick={() => saveEdit(note.id)} className="bg-emerald-500 text-white text-xs h-7">
                        <Check className="w-3 h-3 ml-1" />
                        שמור
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="font-bold text-sm leading-tight pr-6">{note.title}</h4>
                    {note.content && (
                      <p className="text-xs mt-1 opacity-80 leading-relaxed line-clamp-3">{note.content}</p>
                    )}
                    {/* Extra fields */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {note.client_name && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] opacity-70">
                          <User className="w-2.5 h-2.5" />
                          {note.client_name}
                        </span>
                      )}
                      {note.category && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] opacity-70">
                          <Tag className="w-2.5 h-2.5" />
                          {CATEGORY_OPTIONS.find(c => c.value === note.category)?.label || note.category}
                        </span>
                      )}
                      {note.due_date && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] opacity-70">
                          <Calendar className="w-2.5 h-2.5" />
                          {note.due_date}
                        </span>
                      )}
                      {note.urgency && note.urgency !== 'none' && (
                        <Badge className={`text-[10px] px-1 py-0 h-4 ${URGENCY_OPTIONS.find(u => u.value === note.urgency)?.color || ''}`}>
                          {URGENCY_OPTIONS.find(u => u.value === note.urgency)?.label}
                        </Badge>
                      )}
                    </div>
                    {note.linked_task_title && (
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                        <Link2 className="w-3 h-3" />
                        <span className="truncate">{note.linked_task_title}</span>
                      </div>
                    )}

                    {/* Actions - show on hover */}
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePin(note)}
                        className="p-1 rounded-full hover:bg-white/50 transition-colors"
                        title={note.pinned ? 'הסר הצמדה' : 'הצמד'}
                      >
                        {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 rounded-full hover:bg-white/50 transition-colors"
                        title="ערוך"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 rounded-full hover:bg-white/50 transition-colors"
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Show more link in compact mode */}
      {compact && unpinnedNotes.length > 3 && (
        <p className="text-xs text-center text-gray-400">
          +{unpinnedNotes.length - 3} פתקים נוספים
        </p>
      )}
    </div>
  );
}

/**
 * Helper: Create a sticky note from a task
 * Can be called from Tasks page or anywhere else
 */
export async function createNoteFromTask(task) {
  const note = await StickyNote.create({
    title: task.title,
    content: task.description || '',
    color: task.context === 'work' ? 'blue' : 'green',
    pinned: true,
    linked_task_id: task.id,
    linked_task_title: task.title,
    order: Date.now(),
  });
  return note;
}
