
import React, { useState } from 'react';
const fixShortYear = (v) => { if (!v) return v; const m = v.match(/^(\d{1,2})-(\d{2})-(\d{2})$/); if (m) { const yr = parseInt(m[1], 10); return `${yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr}-${m[2]}-${m[3]}`; } return v; };
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  X, Calendar, Clock, MapPin, User, Edit3, Trash2, Save,
  AlertTriangle, ExternalLink, Paperclip
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { Task, Event } from '@/api/entities';
import { TASK_STATUS_CONFIG } from '@/config/processTemplates';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';

export default function EventDetailsModal({ item, itemType, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(item);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (itemType === 'task') {
        const saveData = { ...editData };
        // Add completed_date when marking as completed
        if (saveData.status === 'completed' && item.status !== 'completed') {
          saveData.completed_date = format(new Date(), 'yyyy-MM-dd');
        }
        await Task.update(item.id, saveData);
        // Sync notes if status changed
        if (editData.status !== item.status) {
          syncNotesWithTaskStatus(item.id, editData.status);
        }
      } else {
        await Event.update(item.id, editData);
      }

      setIsEditing(false);
      if (onSave) await onSave();

    } catch (err) {
      setError('שגיאה בשמירת השינויים: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (itemType === 'task') {
        await Task.delete(item.id);
      } else {
        await Event.delete(item.id);
      }

      if (onSave) await onSave();
      onClose();

    } catch (err) {
      setError('שגיאה במחיקה: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    try {
      return format(parseISO(dateTimeString), 'dd/MM/yyyy HH:mm', { locale: he });
    } catch {
      return dateTimeString;
    }
  };

  const getStatusConfig = (status) => {
    return TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.not_started;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-green-100 text-green-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-amber-100 text-amber-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority) => {
    const labels = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף' };
    return labels[priority] || priority;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <Card className="shadow-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">
                {isEditing ?
                  (itemType === 'task' ? 'עריכת משימה' : 'עריכת אירוע') :
                  (itemType === 'task' ? 'פרטי משימה' : 'פרטי אירוע')
                }
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-amber-600 hover:text-amber-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {showDeleteConfirm && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p>האם אתה בטוח שברצונך למחוק {itemType === 'task' ? 'משימה' : 'אירוע'} זה?</p>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading}>
                          {isLoading ? 'מוחק...' : 'כן, מחק'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">כותרת</Label>
                    <Input
                      id="title"
                      value={editData.title || ''}
                      onChange={(e) => setEditData({...editData, title: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">תיאור</Label>
                    <Textarea
                      id="description"
                      value={editData.description || ''}
                      onChange={(e) => setEditData({...editData, description: e.target.value})}
                      rows={3}
                    />
                  </div>

                  {itemType === 'task' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="status">סטטוס</Label>
                          <Select value={editData.status || 'not_started'} onValueChange={(value) => setEditData({...editData, status: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>{cfg.text}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="priority">עדיפות</Label>
                          <Select value={editData.priority || 'medium'} onValueChange={(value) => setEditData({...editData, priority: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">נמוכה</SelectItem>
                              <SelectItem value="medium">בינונית</SelectItem>
                              <SelectItem value="high">גבוהה</SelectItem>
                              <SelectItem value="urgent">דחופה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="due_date">תאריך יעד</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={editData.due_date ? editData.due_date.substring(0, 10) : ''}
                          onChange={(e) => setEditData({...editData, due_date: e.target.value || null})}
                          onBlur={(e) => { const f = fixShortYear(e.target.value); if (f !== e.target.value) setEditData(prev => ({...prev, due_date: f})); }}
                        />
                      </div>

                      <div>
                        <Label htmlFor="estimated_duration">משך זמן משוער (דקות)</Label>
                        <Input
                          id="estimated_duration"
                          type="number"
                          value={editData.estimated_duration || ''}
                          onChange={(e) => setEditData({...editData, estimated_duration: parseInt(e.target.value) || 0})}
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5" />
                          קבצים מצורפים
                        </Label>
                        <TaskFileAttachments
                          taskId={item.id}
                          attachments={editData.attachments || []}
                          onUpdate={(updated) => setEditData(prev => ({ ...prev, attachments: updated }))}
                          clientId={item.client_id}
                          clientName={item.client_name}
                        />
                      </div>
                    </>
                  )}

                  {itemType === 'event' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_date">תאריך ושעת התחלה</Label>
                          <Input
                            id="start_date"
                            type="datetime-local"
                            value={editData.start_date ? format(parseISO(editData.start_date), "yyyy-MM-dd'T'HH:mm") : ''}
                            onChange={(e) => setEditData({...editData, start_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="end_date">תאריך ושעת סיום</Label>
                          <Input
                            id="end_date"
                            type="datetime-local"
                            value={editData.end_date ? format(parseISO(editData.end_date), "yyyy-MM-dd'T'HH:mm") : ''}
                            onChange={(e) => setEditData({...editData, end_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="location">מקום</Label>
                        <Input
                          id="location"
                          value={editData.location || ''}
                          onChange={(e) => setEditData({...editData, location: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="meeting_link">קישור לפגישה</Label>
                        <Input
                          id="meeting_link"
                          value={editData.meeting_link || ''}
                          onChange={(e) => setEditData({...editData, meeting_link: e.target.value})}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => {setIsEditing(false); setEditData(item);}}>
                      ביטול
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Clock className="w-4 h-4 ml-2 animate-spin" />
                          שומר...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 ml-2" />
                          שמור
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{item.title}</h3>
                    {item.description && (
                      <p className="text-gray-600 mt-2">{item.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {itemType === 'task' && (
                      <>
                        <Badge className={getStatusConfig(item.status).color}>
                          {getStatusConfig(item.status).text}
                        </Badge>
                        <Badge className={getPriorityColor(item.priority)}>
                          עדיפות {getPriorityLabel(item.priority)}
                        </Badge>
                      </>
                    )}
                    {itemType === 'event' && item.category && (
                      <Badge variant="outline">{item.category}</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {itemType === 'task' ? (
                      <>
                        {item.due_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>תאריך יעד: {format(parseISO(item.due_date), 'dd/MM/yyyy', { locale: he })}</span>
                          </div>
                        )}
                        {item.estimated_duration && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span>משך זמן: {item.estimated_duration} דקות</span>
                          </div>
                        )}
                        {item.assigned_to && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>מוקצה ל: {item.assigned_to}</span>
                          </div>
                        )}
                        {item.client_name && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>לקוח: {item.client_name}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {item.start_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>התחלה: {formatDateTime(item.start_date)}</span>
                          </div>
                        )}
                        {item.end_date && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span>סיום: {formatDateTime(item.end_date)}</span>
                          </div>
                        )}
                        {item.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span>מקום: {item.location}</span>
                          </div>
                        )}
                        {item.meeting_link && (
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                            <a href={item.meeting_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              קישור לפגישה
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {item.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-700 mb-2">הערות:</h4>
                      <p className="text-gray-600">{item.notes}</p>
                    </div>
                  )}

                  {itemType === 'task' && item.attachments?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Paperclip className="w-4 h-4" />
                        קבצים מצורפים ({item.attachments.length})
                      </h4>
                      <div className="space-y-1">
                        {item.attachments.map((att, idx) => (
                          <a
                            key={att.id || idx}
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-blue-600 hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                            {att.file_name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
