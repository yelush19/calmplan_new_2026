
import React, { useState } from 'react';
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
  AlertTriangle, CheckCircle, ExternalLink 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { Task, Event } from '@/api/entities';

export default function EventDetailsModal({ item, itemType, onClose, onSave, onEdit }) {
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
        await Task.update(item.id, editData);
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

  const getStatusColor = (status) => {
    const colors = {
      not_started: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      waiting_for_approval: 'bg-yellow-100 text-yellow-800',
      postponed: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-green-100 text-green-800', 
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <Card className="shadow-2xl">
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
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-red-600 hover:text-red-700">
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
                          <Select value={editData.status} onValueChange={(value) => setEditData({...editData, status: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">לא התחיל</SelectItem>
                              <SelectItem value="in_progress">בביצוע</SelectItem>
                              <SelectItem value="completed">הושלם</SelectItem>
                              <SelectItem value="waiting_for_approval">ממתין לאישור</SelectItem>
                              <SelectItem value="postponed">נדחה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="priority">עדיפות</Label>
                          <Select value={editData.priority} onValueChange={(value) => setEditData({...editData, priority: value})}>
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
                          value={editData.due_date ? format(parseISO(editData.due_date), "yyyy-MM-dd") : ''}
                          onChange={(e) => setEditData({...editData, due_date: e.target.value ? new Date(e.target.value).toISOString() : null})}
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
                        <Badge className={getStatusColor(item.status)}>
                          {item.status === 'not_started' ? 'לא התחיל' :
                           item.status === 'in_progress' ? 'בביצוע' :
                           item.status === 'completed' ? 'הושלם' :
                           item.status === 'waiting_for_approval' ? 'ממתין לאישור' :
                           item.status === 'postponed' ? 'נדחה' : item.status}
                        </Badge>
                        <Badge className={getPriorityColor(item.priority)}>
                          {item.priority === 'low' ? 'עדיפות נמוכה' :
                           item.priority === 'medium' ? 'עדיפות בינונית' :
                           item.priority === 'high' ? 'עדיפות גבוהה' :
                           item.priority === 'urgent' ? 'דחוף' : item.priority}
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
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
