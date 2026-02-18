import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Save, X, Plus, Trash2, CheckSquare, Square,
  AlertTriangle, ArrowUp, ArrowRight, ArrowDown, ListChecks, StickyNote
} from 'lucide-react';
import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'דחוף', icon: AlertTriangle, color: 'text-red-600' },
  { value: 'high', label: 'גבוה', icon: ArrowUp, color: 'text-orange-500' },
  { value: 'medium', label: 'בינוני', icon: ArrowRight, color: 'text-yellow-500' },
  { value: 'low', label: 'נמוך', icon: ArrowDown, color: 'text-blue-400' },
];

export default function TaskEditDialog({ task, open, onClose, onSave, onDelete }) {
  const [editData, setEditData] = useState({});
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDue, setNewSubDue] = useState('');

  useEffect(() => {
    if (task && open) {
      setEditData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'not_started',
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        notes: task.notes || '',
        sub_tasks: task.sub_tasks || [],
      });
      setNewSubTitle('');
      setNewSubDue('');
    }
  }, [task, open]);

  if (!task) return null;

  const handleSave = () => {
    onSave(task.id, editData);
    onClose();
  };

  const handleAddSubTask = () => {
    if (!newSubTitle.trim()) return;
    const updated = [
      ...editData.sub_tasks,
      { id: `st_${Date.now()}`, title: newSubTitle.trim(), due_date: newSubDue || null, done: false }
    ];
    setEditData(prev => ({ ...prev, sub_tasks: updated }));
    setNewSubTitle('');
    setNewSubDue('');
  };

  const handleToggleSubTask = (subId) => {
    const updated = editData.sub_tasks.map(st =>
      st.id === subId ? { ...st, done: !st.done } : st
    );
    setEditData(prev => ({ ...prev, sub_tasks: updated }));
  };

  const handleDeleteSubTask = (subId) => {
    setEditData(prev => ({
      ...prev,
      sub_tasks: prev.sub_tasks.filter(st => st.id !== subId)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4" />
            עריכת משימה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">כותרת</Label>
            <Input
              value={editData.title}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              className="text-sm"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">סטטוס</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, { text, color }]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      <span className={`inline-flex items-center gap-1.5`}>
                        <span className={`w-2 h-2 rounded-full ${color.split(' ')[0]}`} />
                        {text}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">עדיפות</Label>
              <Select value={editData.priority} onValueChange={(v) => setEditData(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      <span className={`inline-flex items-center gap-1.5 ${p.color}`}>
                        <p.icon className="w-3 h-3" />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">תאריך יעד</Label>
            <Input
              type="date"
              value={editData.due_date}
              onChange={(e) => setEditData(prev => ({ ...prev, due_date: e.target.value }))}
              className="text-sm h-9"
              dir="ltr"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              הערות
            </Label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-md p-2 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="הוסף הערה..."
            />
          </div>

          {/* Sub Tasks */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              תת משימות ({editData.sub_tasks?.length || 0})
            </Label>

            {editData.sub_tasks?.length > 0 && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {editData.sub_tasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2 p-1.5 rounded bg-gray-50 group">
                    <button onClick={() => handleToggleSubTask(st.id)} className="shrink-0">
                      {st.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <span className={`text-xs flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {st.title}
                    </span>
                    {st.due_date && (
                      <span className="text-[10px] text-gray-400">{st.due_date}</span>
                    )}
                    <button
                      onClick={() => handleDeleteSubTask(st.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add sub task */}
            <div className="flex items-center gap-2">
              <Input
                value={newSubTitle}
                onChange={(e) => setNewSubTitle(e.target.value)}
                placeholder="תת משימה חדשה..."
                className="text-xs h-8 flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
              />
              <Input
                type="date"
                value={newSubDue}
                onChange={(e) => setNewSubDue(e.target.value)}
                className="text-xs h-8 w-[130px]"
                dir="ltr"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 shrink-0"
                onClick={handleAddSubTask}
                disabled={!newSubTitle.trim()}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Client info (read-only) */}
          {task.client_name && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
              לקוח: <span className="font-medium text-gray-700">{task.client_name}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק משימה
              </Button>
            )}
            <div className="flex items-center gap-2 mr-auto">
              <Button variant="outline" size="sm" onClick={onClose}>
                ביטול
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-1">
                <Save className="w-3.5 h-3.5" />
                שמור
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
