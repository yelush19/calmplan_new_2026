import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Briefcase, Home as HomeIcon, Search, ChevronDown, X, Clock } from 'lucide-react';
import { Task, Client } from '@/api/entities';
import { ALL_SERVICES } from '@/config/processTemplates';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Group services by dashboard for the dropdown
const SERVICE_GROUPS = [
  { key: 'tax', label: 'דיווחי מיסים' },
  { key: 'payroll', label: 'שכר' },
  { key: 'additional', label: 'שירותים נוספים' },
];

const SERVICE_LIST = Object.values(ALL_SERVICES).map(s => ({
  key: s.key,
  label: s.label,
  dashboard: s.dashboard,
  createCategory: s.createCategory,
}));

// Searchable dropdown component
function SearchableSelect({ value, onChange, items, placeholder, renderItem, groupBy, groupLabels, allowNone, noneLabel = 'ללא' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => {
      const label = typeof renderItem === 'function' ? renderItem(item) : (item.label || item.name || '');
      return String(label).toLowerCase().includes(q);
    });
  }, [items, search, renderItem]);

  const selectedItem = items.find(i => i.id === value || i.key === value);
  const displayLabel = selectedItem ? (renderItem ? renderItem(selectedItem) : selectedItem.label || selectedItem.name) : (value === '__none__' ? noneLabel : placeholder);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center justify-between h-9 px-3 text-xs border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
      >
        <span className={`truncate ${!selectedItem && value === '__none__' ? 'text-gray-400' : 'text-gray-800'}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col">
          {/* Search input */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חפש..."
                className="w-full h-7 text-xs pr-7 pl-2 border border-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange('__none__'); setIsOpen(false); }}
                className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${value === '__none__' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-500'}`}
              >
                {noneLabel}
              </button>
            )}

            {groupBy ? (
              // Grouped rendering
              groupLabels.map(group => {
                const groupItems = filtered.filter(i => i[groupBy] === group.key);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.key}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 bg-gray-50 sticky top-0">
                      {group.label}
                    </div>
                    {groupItems.map(item => {
                      const itemKey = item.id || item.key;
                      const isSelected = itemKey === value;
                      return (
                        <button
                          type="button"
                          key={itemKey}
                          onClick={() => { onChange(itemKey); setIsOpen(false); }}
                          className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                        >
                          {renderItem ? renderItem(item) : item.label || item.name}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              // Flat rendering
              filtered.map(item => {
                const itemKey = item.id || item.key;
                const isSelected = itemKey === value;
                return (
                  <button
                    type="button"
                    key={itemKey}
                    onClick={() => { onChange(itemKey); setIsOpen(false); }}
                    className={`w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                  >
                    {renderItem ? renderItem(item) : item.label || item.name}
                  </button>
                );
              })
            )}

            {filtered.length === 0 && !allowNone && (
              <div className="text-center py-3 text-xs text-gray-400">לא נמצאו תוצאות</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickAddTaskDialog({ open, onOpenChange, onCreated, defaultContext = 'work', defaultCategory = '' }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState('');
  const [duration, setDuration] = useState('');
  const [context, setContext] = useState(defaultContext);
  const [serviceKey, setServiceKey] = useState(defaultCategory || '__none__');
  const [clientId, setClientId] = useState('__none__');
  const [clients, setClients] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Client.list(null, 500).then(list => {
        setClients((list || []).filter(c => c.status === 'active').sort((a, b) => a.name?.localeCompare(b.name, 'he')));
      }).catch(() => setClients([]));
      setTitle('');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setDueTime('');
      setDuration('');
      setContext(defaultContext);
      setServiceKey(defaultCategory || '__none__');
      setClientId('__none__');
    }
  }, [open, defaultContext, defaultCategory]);

  const selectedService = serviceKey !== '__none__' ? SERVICE_LIST.find(s => s.key === serviceKey) : null;
  const selectedClient = clientId !== '__none__' ? clients.find(c => c.id === clientId) : null;

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const category = selectedService?.createCategory || '';
      const scheduledStart = category && dueDate ? getScheduledStartForCategory(category, dueDate) : null;

      // Build title with client name if selected
      let taskTitle = title.trim();
      if (selectedClient && !taskTitle.includes(selectedClient.name)) {
        taskTitle = `${taskTitle} - ${selectedClient.name}`;
      }

      await Task.create({
        title: taskTitle,
        status: 'not_started',
        due_date: dueDate,
        due_time: dueTime || undefined,
        estimated_duration: duration ? parseInt(duration) : undefined,
        scheduled_start: scheduledStart || undefined,
        context,
        category,
        client_name: selectedClient?.name || undefined,
        client_id: selectedClient?.id || undefined,
        client_related: !!selectedClient,
        priority: 'medium',
      });

      toast.success('משימה נוצרה בהצלחה');
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('שגיאה ביצירת משימה:', err);
      toast.error('שגיאה ביצירת המשימה');
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            הוספת משימה מהירה
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Title */}
          <div>
            <Label htmlFor="qa-title" className="text-xs">תיאור המשימה</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה צריך לעשות?"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Service type (searchable) + Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">סוג שירות</Label>
              <SearchableSelect
                value={serviceKey}
                onChange={setServiceKey}
                items={SERVICE_LIST}
                placeholder="בחר שירות"
                renderItem={(item) => item.label}
                groupBy="dashboard"
                groupLabels={SERVICE_GROUPS}
                allowNone
                noneLabel="ללא (כללי)"
              />
            </div>
            <div>
              <Label className="text-xs">הקשר</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work" className="text-xs">
                    <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> עבודה</span>
                  </SelectItem>
                  <SelectItem value="home" className="text-xs">
                    <span className="inline-flex items-center gap-1"><HomeIcon className="w-3 h-3" /> בית</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client (searchable) */}
          <div>
            <Label className="text-xs">שיוך ללקוח</Label>
            <SearchableSelect
              value={clientId}
              onChange={setClientId}
              items={clients}
              placeholder="בחר לקוח"
              renderItem={(item) => item.name}
              allowNone
              noneLabel="ללא לקוח"
            />
          </div>

          {/* Due date + Time + Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">תאריך יעד</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-9"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                שעה
              </Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="text-xs h-9"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs">משך (דקות)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                className="text-xs h-9"
                dir="ltr"
                min="0"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="w-full gap-1"
          >
            <Plus className="w-4 h-4" />
            {isSaving ? 'שומר...' : 'הוסף משימה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
