import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckSquare, Calendar, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, Event } from '@/api/entities';

const QUICK_ADD_TYPES = [
  { id: 'task', label: 'משימה', icon: CheckSquare, color: '#10b981' },
  { id: 'event', label: 'אירוע', icon: Calendar, color: '#8b5cf6' },
];

const TASK_CATEGORIES = [
  { value: 'work_payroll', label: 'שכר' },
  { value: 'work_vat_reporting', label: 'מע"מ' },
  { value: 'work_tax_advances', label: 'מקדמות מס' },
  { value: 'work_bookkeeping', label: 'הנה"ח' },
  { value: 'work_annual_reports', label: 'מאזנים' },
  { value: 'work', label: 'עבודה - כללי' },
  { value: 'personal', label: 'אישי' },
  { value: 'admin', label: 'אדמיניסטרציה' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'דחוף' },
  { value: 'high', label: 'גבוה' },
  { value: 'medium', label: 'רגיל' },
  { value: 'low', label: 'נמוך' },
];

export default function QuickAddModal({ isOpen, onClose }) {
  const [activeType, setActiveType] = useState('task');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'work',
    priority: 'medium',
    due_date: '',
  });

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    setIsLoading(true);

    try {
      if (activeType === 'task') {
        await Task.create({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          priority: formData.priority,
          due_date: formData.due_date || undefined,
          status: 'not_started',
        });
      } else if (activeType === 'event') {
        await Event.create({
          title: formData.title,
          description: formData.description,
          start_date: formData.due_date || new Date().toISOString().split('T')[0],
        });
      }

      // Reset and close
      setFormData({ title: '', description: '', category: 'work', priority: 'medium', due_date: '' });
      onClose();
    } catch (error) {
      console.error('Error creating item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={onClose}
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex gap-2">
                {QUICK_ADD_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveType(type.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeType === type.id
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4" dir="rtl">
              {/* Title - auto-focused */}
              <Input
                placeholder={activeType === 'task' ? 'שם המשימה...' : 'שם האירוע...'}
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={handleKeyDown}
                autoFocus
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-lg"
              />

              {/* Description */}
              <Textarea
                placeholder="תיאור (אופציונלי)..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />

              {/* Row: Category + Priority + Date */}
              <div className="grid grid-cols-3 gap-3">
                {activeType === 'task' && (
                  <>
                    <Select
                      value={formData.category}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                        <SelectValue placeholder="קטגוריה" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={formData.priority}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, priority: val }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                        <SelectValue placeholder="עדיפות" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className={`bg-white/5 border-white/10 text-white text-sm ${activeType !== 'task' ? 'col-span-3' : ''}`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
              <span className="text-white/30 text-xs">Ctrl+Enter לשמירה</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white/50 hover:text-white hover:bg-white/10"
                >
                  ביטול
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isLoading || !formData.title.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'שומר...' : 'הוסף'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
