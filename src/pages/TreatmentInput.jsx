import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  User,
  FileText,
  Save,
  X
} from 'lucide-react';
import { Treatment, Therapist } from '@/api/entities';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'מתוכנן', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'completed', label: 'בוצע', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'cancelled', label: 'בוטל', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'rescheduled', label: 'נדחה', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
];

const TREATMENT_TYPES = ['פסיכולוג/ית', 'פסיכיאטר/ית', 'רופא/ת משפחה', 'פיזיותרפיה', 'מטפל/ת רגשי/ת', 'אחר'];

export default function TreatmentInputPage() {
  const [treatments, setTreatments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    therapist_name: '',
    treatment_type: '',
    date: '',
    time: '',
    status: 'scheduled',
    notes: '',
    summary: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, th] = await Promise.all([
        Treatment.list('-date', 200),
        Therapist.list(null, 50),
      ]);
      setTreatments(Array.isArray(t) ? t : []);
      setTherapists(Array.isArray(th) ? th : []);
    } catch (err) {
      console.error('Failed to load treatments:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ therapist_name: '', treatment_type: '', date: '', time: '', status: 'scheduled', notes: '', summary: '' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.therapist_name.trim() || !form.date) {
      toast.error('נא למלא שם מטפל/ת ותאריך');
      return;
    }
    try {
      if (editId) {
        await Treatment.update(editId, form);
        setTreatments(prev => prev.map(t => t.id === editId ? { ...t, ...form } : t));
        toast.success('הטיפול עודכן');
      } else {
        const created = await Treatment.create(form);
        setTreatments(prev => [created, ...prev]);
        toast.success('הטיפול נוסף');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בשמירה');
    }
  };

  const handleEdit = (treatment) => {
    setForm({
      therapist_name: treatment.therapist_name || '',
      treatment_type: treatment.treatment_type || '',
      date: treatment.date || '',
      time: treatment.time || '',
      status: treatment.status || 'scheduled',
      notes: treatment.notes || '',
      summary: treatment.summary || '',
    });
    setEditId(treatment.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await Treatment.delete(id);
      setTreatments(prev => prev.filter(t => t.id !== id));
      toast.success('הטיפול הוסר');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await Treatment.update(id, { status });
      setTreatments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusInfo = (status) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  const upcoming = treatments.filter(t => t.status === 'scheduled' && t.date >= new Date().toISOString().slice(0, 10));
  const past = treatments.filter(t => t.status !== 'scheduled' || (t.date && t.date < new Date().toISOString().slice(0, 10)));

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#1E3A5F]" />
          <h1 className="text-xl font-bold text-[#1E3A5F]">הזנת טיפולים</h1>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#1E3A5F] dark:text-white" />
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">הזנת טיפולים</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">ניהול וזימון טיפולים</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90">
          <Plus className="w-4 h-4" />
          טיפול חדש
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">מתוכננים</p>
              <p className="text-lg font-bold dark:text-white">{upcoming.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">בוצעו</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{treatments.filter(t => t.status === 'completed').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <User className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">מטפלים</p>
              <p className="text-lg font-bold dark:text-white">{new Set(treatments.map(t => t.therapist_name)).size}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">סה"כ</p>
              <p className="text-lg font-bold dark:text-white">{treatments.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between dark:text-white">
                  {editId ? 'עריכת טיפול' : 'טיפול חדש'}
                  <Button variant="ghost" size="icon" onClick={resetForm} className="w-7 h-7">
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">שם מטפל/ת *</label>
                    <Input
                      value={form.therapist_name}
                      onChange={(e) => setForm({ ...form, therapist_name: e.target.value })}
                      placeholder="ד״ר ישראלי"
                      className="dark:bg-gray-800 dark:border-gray-600"
                      list="therapists-list"
                    />
                    <datalist id="therapists-list">
                      {therapists.map(th => (
                        <option key={th.id} value={th.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">סוג טיפול</label>
                    <select
                      value={form.treatment_type}
                      onChange={(e) => setForm({ ...form, treatment_type: e.target.value })}
                      className="w-full rounded-md border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 text-sm"
                    >
                      <option value="">בחר סוג...</option>
                      {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">תאריך *</label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="dark:bg-gray-800 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">שעה</label>
                    <Input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="dark:bg-gray-800 dark:border-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">הערות</label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="הערות לטיפול..."
                    className="dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                {editId && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">סיכום טיפול</label>
                    <Input
                      value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                      placeholder="סיכום הטיפול..."
                      className="dark:bg-gray-800 dark:border-gray-600"
                    />
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={resetForm}>ביטול</Button>
                  <Button size="sm" onClick={handleSave} className="gap-1 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90">
                    <Save className="w-3.5 h-3.5" />
                    {editId ? 'עדכון' : 'שמור'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-[#1E3A5F] dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4" />
            טיפולים קרובים ({upcoming.length})
          </h2>
          {upcoming.map(treatment => (
            <TreatmentCard
              key={treatment.id}
              treatment={treatment}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              getStatusInfo={getStatusInfo}
            />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            היסטוריה ({past.length})
          </h2>
          {past.map(treatment => (
            <TreatmentCard
              key={treatment.id}
              treatment={treatment}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              getStatusInfo={getStatusInfo}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {treatments.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">אין טיפולים עדיין</p>
          <p className="text-xs mt-1">לחצו "טיפול חדש" כדי להתחיל</p>
        </div>
      )}
    </div>
  );
}

function TreatmentCard({ treatment, onEdit, onDelete, onStatusChange, getStatusInfo }) {
  const statusInfo = getStatusInfo(treatment.status);
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-xl shadow-sm border hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">{treatment.therapist_name}</span>
                {treatment.treatment_type && (
                  <Badge variant="secondary" className="text-[10px]">{treatment.treatment_type}</Badge>
                )}
                <Badge className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {treatment.date && <span>{new Date(treatment.date).toLocaleDateString('he-IL')}</span>}
                {treatment.time && <span>{treatment.time}</span>}
              </div>
              {treatment.notes && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{treatment.notes}</p>}
              {treatment.summary && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">סיכום: {treatment.summary}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {treatment.status === 'scheduled' && (
                <Button variant="ghost" size="icon" onClick={() => onStatusChange(treatment.id, 'completed')} className="w-7 h-7 text-green-500 hover:bg-green-50">
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => onEdit(treatment)} className="w-7 h-7 text-gray-400 hover:text-blue-500">
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(treatment.id)} className="w-7 h-7 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
