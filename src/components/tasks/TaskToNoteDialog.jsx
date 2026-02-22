import React, { useState, useEffect } from 'react';
const fixShortYear = (v) => { if (!v) return v; const m = v.match(/^(\d{1,2})-(\d{2})-(\d{2})$/); if (m) { const yr = parseInt(m[1], 10); return `${yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr}-${m[2]}-${m[3]}`; } return v; };
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pin, Calendar, Clock, AlertTriangle, User } from 'lucide-react';
import { StickyNote } from '@/api/entities';
import { toast } from 'sonner';

const URGENCY_OPTIONS = [
  { value: 'low', label: 'נמוך', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
  { value: 'medium', label: 'בינוני', color: 'bg-amber-100 text-amber-700', icon: '🟡' },
  { value: 'high', label: 'גבוה', color: 'bg-orange-100 text-orange-700', icon: '🟠' },
  { value: 'urgent', label: 'דחוף', color: 'bg-rose-100 text-rose-700', icon: '🔴' },
];

const COLOR_MAP = {
  urgent: 'pink',
  high: 'pink',
  medium: 'yellow',
  low: 'blue',
};

export default function TaskToNoteDialog({ task, open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task && open) {
      setTitle(task.title || '');
      const parts = [];
      if (task.client_name) parts.push(`לקוח: ${task.client_name}`);
      if (task.category) parts.push(`קטגוריה: ${task.category}`);
      if (task.description) parts.push(task.description);
      setContent(parts.join('\n'));
      setDueDate(task.due_date || '');
      setDueTime('09:00');
      // Map task priority to urgency
      if (task.priority === 'urgent') setUrgency('urgent');
      else if (task.priority === 'high') setUrgency('high');
      else if (task.priority === 'medium') setUrgency('medium');
      else setUrgency('low');
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const noteContent = dueTime
        ? `${content}\n\nשעת ביצוע: ${dueTime}`
        : content;

      await StickyNote.create({
        title: `📌 ${title.trim()}`,
        content: noteContent.trim(),
        color: COLOR_MAP[urgency] || 'yellow',
        pinned: true,
        linked_task_id: task?.id || null,
        linked_task_title: task?.title || null,
        client_name: task?.client_name || null,
        urgency,
        due_date: dueDate || null,
        category: 'client_work',
        order: Date.now(),
      });

      toast.success('נוצר פתק תזכורת');
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('שגיאה ביצירת הפתק');
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Pin className="w-5 h-5 text-amber-500" />
            הוסף תזכורת לפתק דביק
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task info preview */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="font-semibold text-gray-800">{task.title}</div>
            {task.client_name && (
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <User className="w-3 h-3" />
                {task.client_name}
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1 text-gray-500 text-xs">
                <Calendar className="w-3 h-3" />
                דדליין: {task.due_date}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">כותרת הפתק</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת..."
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">תוכן / הערות</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="פרטים נוספים..."
              rows={3}
            />
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                מועד ביצוע
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setDueDate(f); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                שעה
              </Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              עדיפות
            </Label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setUrgency(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                    urgency === opt.value
                      ? `${opt.color} border-current ring-1 ring-current`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-center">
                    <span className="text-base">{opt.icon}</span>
                    <div className="text-xs mt-0.5">{opt.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>ביטול</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Pin className="w-4 h-4 ml-2" />
              {saving ? 'שומר...' : 'צור תזכורת'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
