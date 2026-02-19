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
  AlertTriangle, ArrowUp, ArrowRight, ArrowDown, ListChecks, StickyNote,
  Calendar, Clock, Timer, Wand2, Paperclip
} from 'lucide-react';
import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';
import { differenceInDays, format, parseISO, isValid } from 'date-fns';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import { toast } from 'sonner';

// Fix 2-digit year inputs: "26-01-15" -> "2026-01-15"
const fixShortYear = (value) => {
  if (!value) return value;
  const match = value.match(/^(\d{1,2})-(\d{2})-(\d{2})$/);
  if (match) {
    const yr = parseInt(match[1], 10);
    const fullYear = yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr;
    return `${fullYear}-${match[2]}-${match[3]}`;
  }
  return value;
};

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'דחוף', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'high', label: 'גבוה', icon: ArrowUp, color: 'text-orange-500' },
  { value: 'medium', label: 'בינוני', icon: ArrowRight, color: 'text-yellow-500' },
  { value: 'low', label: 'נמוך', icon: ArrowDown, color: 'text-blue-400' },
];

function ExecutionTimeline({ startDate, dueDate }) {
  if (!startDate || !dueDate) return null;

  const start = parseISO(startDate);
  const end = parseISO(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!isValid(start) || !isValid(end)) return null;

  const totalDays = differenceInDays(end, start);
  const elapsed = differenceInDays(today, start);
  const remaining = differenceInDays(end, today);
  const progress = totalDays > 0 ? Math.min(Math.max((elapsed / totalDays) * 100, 0), 100) : 0;

  const isOverdue = remaining < 0;
  const isUrgent = remaining >= 0 && remaining <= 1;
  const isWarning = remaining >= 2 && remaining <= 3;

  const barColor = isOverdue ? 'bg-amber-500' : isUrgent ? 'bg-amber-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor = isOverdue ? 'text-amber-600' : isUrgent ? 'text-amber-500' : isWarning ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-500">
          <Timer className="w-3 h-3" />
          תקופת ביצוע
        </span>
        <span className={`font-bold ${textColor}`}>
          {isOverdue
            ? `באיחור ${Math.abs(remaining)} ימים!`
            : remaining === 0
              ? 'היום דדליין!'
              : `נותרו ${remaining} ימים`}
        </span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>התחלה: {format(start, 'd/M')}</span>
        <span>{totalDays} ימים סה"כ</span>
        <span>סיום: {format(end, 'd/M')}</span>
      </div>
    </div>
  );
}

export default function TaskEditDialog({ task, open, onClose, onSave, onDelete }) {
  const [editData, setEditData] = useState({});
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDue, setNewSubDue] = useState('');
  const [newSubTime, setNewSubTime] = useState('');
  const [newSubPriority, setNewSubPriority] = useState('medium');

  useEffect(() => {
    if (task && open) {
      setEditData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'not_started',
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        due_time: task.due_time || '',
        estimated_duration: task.estimated_duration || '',
        scheduled_start: task.scheduled_start || '',
        notes: task.notes || '',
        sub_tasks: task.sub_tasks || [],
      });
      setNewSubTitle('');
      setNewSubDue('');
      setNewSubTime('');
      setNewSubPriority('medium');
    }
  }, [task, open]);

  if (!task) return null;

  const handleSave = () => {
    onSave(task.id, editData);
    // Clean up linked sticky notes if task is now completed/cancelled
    syncNotesWithTaskStatus(task.id, editData.status);
    onClose();
  };

  const handleAddSubTask = () => {
    if (!newSubTitle.trim()) return;
    const updated = [
      ...editData.sub_tasks,
      { id: `st_${Date.now()}`, title: newSubTitle.trim(), due_date: newSubDue || null, due_time: newSubTime || null, priority: newSubPriority || 'medium', done: false }
    ];
    setEditData(prev => ({ ...prev, sub_tasks: updated }));
    setNewSubTitle('');
    setNewSubDue('');
    setNewSubTime('');
    setNewSubPriority('medium');
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

          {/* Execution Period: Start Date + Due Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                תקופת ביצוע
              </Label>
              {editData.due_date && task.category && (
                <button
                  type="button"
                  onClick={() => {
                    const startDate = getScheduledStartForCategory(task.category, editData.due_date);
                    if (startDate) {
                      setEditData(prev => ({ ...prev, scheduled_start: startDate }));
                      toast.success('תאריך התחלה מולא מתבנית');
                    } else {
                      toast.info('לא נמצאה תבנית לקטגוריה זו');
                    }
                  }}
                  className="text-[10px] text-violet-600 hover:text-violet-800 flex items-center gap-1 hover:bg-violet-50 px-1.5 py-0.5 rounded"
                >
                  <Wand2 className="w-3 h-3" />
                  מלא מתבנית
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">תאריך התחלה</span>
                <Input
                  type="date"
                  value={editData.scheduled_start}
                  onChange={(e) => setEditData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                  onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setEditData(prev => ({ ...prev, scheduled_start: f })); }}
                  className="text-sm h-9"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">תאריך יעד (דדליין)</span>
                <Input
                  type="date"
                  value={editData.due_date}
                  onChange={(e) => setEditData(prev => ({ ...prev, due_date: e.target.value }))}
                  onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setEditData(prev => ({ ...prev, due_date: f })); }}
                  className="text-sm h-9"
                  dir="ltr"
                />
              </div>
            </div>
            {/* Time + Duration */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  שעה
                </span>
                <Input
                  type="time"
                  value={editData.due_time}
                  onChange={(e) => setEditData(prev => ({ ...prev, due_time: e.target.value }))}
                  className="text-sm h-9"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  משך משימה (דקות)
                </span>
                <Input
                  type="number"
                  value={editData.estimated_duration}
                  onChange={(e) => setEditData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                  placeholder="30"
                  className="text-sm h-9"
                  dir="ltr"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Execution Timeline Visual */}
          <ExecutionTimeline startDate={editData.scheduled_start} dueDate={editData.due_date} />

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
                {editData.sub_tasks.map(st => {
                  const stPri = PRIORITY_OPTIONS.find(p => p.value === st.priority);
                  return (
                    <div key={st.id} className="flex items-center gap-2 p-1.5 rounded bg-gray-50 group">
                      <button onClick={() => handleToggleSubTask(st.id)} className="shrink-0">
                        {st.done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {stPri && (
                        <stPri.icon className={`w-3 h-3 shrink-0 ${stPri.color}`} />
                      )}
                      <span className={`text-xs flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {st.title}
                      </span>
                      {st.due_time && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{st.due_time}
                        </span>
                      )}
                      {st.due_date && (
                        <span className="text-[10px] text-gray-400">{st.due_date}</span>
                      )}
                      <button
                        onClick={() => handleDeleteSubTask(st.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-amber-400 hover:text-amber-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add sub task */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                  placeholder="תת משימה חדשה..."
                  className="text-xs h-8 flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
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
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={newSubDue}
                  onChange={(e) => setNewSubDue(e.target.value)}
                  onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setNewSubDue(f); }}
                  className="text-xs h-8 w-[120px]"
                  dir="ltr"
                />
                <Input
                  type="time"
                  value={newSubTime}
                  onChange={(e) => setNewSubTime(e.target.value)}
                  className="text-xs h-8 w-[90px]"
                  dir="ltr"
                />
                <Select value={newSubPriority} onValueChange={setNewSubPriority}>
                  <SelectTrigger className="text-xs h-8 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        <span className={`inline-flex items-center gap-1 ${p.color}`}>
                          <p.icon className="w-3 h-3" />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* File Attachments */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              קבצים מצורפים
            </Label>
            <TaskFileAttachments
              taskId={task.id}
              attachments={task.attachments || []}
              onUpdate={(updated) => {
                setEditData(prev => ({ ...prev, attachments: updated }));
              }}
              clientId={task.client_id}
              clientName={task.client_name}
            />
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
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
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
